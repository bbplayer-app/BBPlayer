import Foundation

public struct AudioChunk: Codable, Sendable {
    public var data: Data
    public var offset: Int64
    public var total: Int64
    public init(data: Data, offset: Int64, total: Int64) { self.data = data; self.offset = offset; self.total = total }
}

public final class AudioCache: @unchecked Sendable {
    public let root: URL
    private struct Entry { var bytes: Int64; var used: Date }
    private let lock = NSLock()
    private let writes = DispatchQueue(label: "com.bbplayer.macos.cache-writes", qos: .utility)
    private let reads = DispatchQueue(label: "com.bbplayer.macos.cache-reads", qos: .userInitiated, attributes: .concurrent)
    private var entries: [String: Entry] = [:]
    private var active: [String: Int] = [:]
    private var evicting = Set<String>()
    private var budget: Int64
    private var queuedBytes = 0
    private let writeDelay: TimeInterval
    public static let maximumPendingBytes = 8 * 1024 * 1024
    public var limit: Int64 { lock.withLock { budget } }
    public var pendingWriteBytes: Int { lock.withLock { queuedBytes } }
    public init(root: URL, limit: Int64 = 1_073_741_824, writeDelay: TimeInterval = 0) throws {
        self.root = root; budget = max(0, limit); self.writeDelay = writeDelay
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        writes.async { [self] in
            let urls = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey, .isSymbolicLinkKey])) ?? []
            for url in urls where url.pathExtension == "chunk" {
                guard let info = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey, .isSymbolicLinkKey]), info.isRegularFile == true, info.isSymbolicLink != true else { continue }
                lock.withLock { entries[url.lastPathComponent] = Entry(bytes: Int64(info.fileSize ?? 0), used: info.contentModificationDate ?? .distantPast) }
            }
            _ = try? trim(reserving: 0)
        }
    }
    private static func digest(_ key: String) -> String { WBI.md5(Data(key.utf8)) }
    private func name(_ key: String, _ offset: Int64) -> String { "\(Self.digest(key))-\(offset).chunk" }
    private func protected(_ name: String) -> Bool { active[name, default: 0] > 0 || active[String(name.prefix(32)), default: 0] > 0 }
    public func pin(_ key: String, offset: Int64? = nil) async {
        let id = offset.map { name(key, $0) } ?? Self.digest(key)
        lock.withLock { active[id, default: 0] += 1 }
    }
    public func unpin(_ key: String, offset: Int64? = nil) async {
        let id = offset.map { name(key, $0) } ?? Self.digest(key)
        lock.withLock { if active[id, default: 0] <= 1 { active.removeValue(forKey: id) } else { active[id, default: 0] -= 1 } }
        writes.async { [self] in _ = try? trim(reserving: 0) }
    }
    public func setLimit(_ value: Int64) async throws {
        lock.withLock { budget = max(0, value) }
        _ = try await performWrite { [self] in try trim(reserving: 0) }
    }
    public func size() async throws -> Int64 {
        try await performWrite { [self] in lock.withLock { entries.values.reduce(0) { $0 + $1.bytes } } }
    }
    public func clear() async throws {
        try await performWrite { [self] in
            let candidates = lock.withLock { Array(entries.keys) }
            for id in candidates { _ = try removeIfIdle(id) }
        }
    }
    public func read(key: String, offset: Int64) async throws -> AudioChunk? {
        let id = name(key, offset), url = root.appendingPathComponent(id)
        let admitted = lock.withLock { () -> Bool in
            guard !evicting.contains(id) else { return false }
            active[id, default: 0] += 1; return true
        }
        guard admitted else { return nil }
        return await withCheckedContinuation { continuation in
            reads.async { [self] in
                defer {
                    lock.withLock { if active[id, default: 0] <= 1 { active.removeValue(forKey: id) } else { active[id, default: 0] -= 1 } }
                    writes.async { [self] in _ = try? trim(reserving: 0) }
                }
                guard let data = try? Data(contentsOf: url), let chunk = try? JSONDecoder().decode(AudioChunk.self, from: data),
                      chunk.offset == offset, chunk.total > offset, !chunk.data.isEmpty, Int64(chunk.data.count) <= chunk.total - offset else {
                    continuation.resume(returning: nil); return
                }
                lock.withLock { entries[id] = Entry(bytes: Int64(data.count), used: Date()) }
                writes.async { try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path) }
                continuation.resume(returning: chunk)
            }
        }
    }
    /// Playback submits best-effort writes without waiting for encoding or disk I/O.
    @discardableResult public func enqueueStore(_ chunk: AudioChunk, key: String) -> Bool {
        guard reserve(chunk) else { return false }
        writes.async { [self] in
            defer { lock.withLock { queuedBytes -= chunk.data.count } }
            try? write(chunk, key: key)
        }
        return true
    }
    public func store(_ chunk: AudioChunk, key: String) async throws {
        guard reserve(chunk) else { return }
        try await performWrite { [self] in
            defer { lock.withLock { queuedBytes -= chunk.data.count } }
            try write(chunk, key: key)
        }
    }
    public func flush() async { _ = try? await performWrite { } }
    private func reserve(_ chunk: AudioChunk) -> Bool {
        guard chunk.offset >= 0, chunk.total > chunk.offset, !chunk.data.isEmpty, Int64(chunk.data.count) <= chunk.total - chunk.offset else { return false }
        return lock.withLock {
            guard budget > 0, chunk.data.count <= Self.maximumPendingBytes - queuedBytes else { return false }
            queuedBytes += chunk.data.count; return true
        }
    }
    private func write(_ chunk: AudioChunk, key: String) throws {
        if writeDelay > 0 { Thread.sleep(forTimeInterval: writeDelay) }
        let encoded = try JSONEncoder().encode(chunk)
        guard Int64(encoded.count) <= limit else { return }
        guard try trim(reserving: Int64(encoded.count)) else { return }
        let id = name(key, chunk.offset), url = root.appendingPathComponent(id)
        // Admission includes the previous file plus the new temporary file, until rename.
        try encoded.write(to: url, options: .atomic)
        lock.withLock { entries[id] = Entry(bytes: Int64(encoded.count), used: Date()) }
    }
    @discardableResult private func trim(reserving extra: Int64) throws -> Bool {
        let candidates = lock.withLock { entries.keys.sorted { entries[$0]!.used < entries[$1]!.used } }
        for id in candidates {
            if lock.withLock({ entries.values.reduce(Int64(0)) { $0 + $1.bytes } + extra <= budget }) { return true }
            _ = try removeIfIdle(id)
        }
        return lock.withLock { entries.values.reduce(Int64(0)) { $0 + $1.bytes } + extra <= budget }
    }
    private func removeIfIdle(_ id: String) throws -> Bool {
        let admitted = lock.withLock { () -> Bool in
            guard entries[id] != nil, !protected(id), !evicting.contains(id) else { return false }
            evicting.insert(id); return true
        }
        guard admitted else { return false }
        defer { _ = lock.withLock { evicting.remove(id) } }
        // Slow filesystem work must never hold the lock used by playback admission.
        do { try FileManager.default.removeItem(at: root.appendingPathComponent(id)) }
        catch CocoaError.fileNoSuchFile { }
        lock.withLock { _ = entries.removeValue(forKey: id) }
        return true
    }
    private func performWrite<T>(_ work: @escaping @Sendable () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in writes.async { continuation.resume(with: Result { try work() }) } }
    }
}

public enum HTTPRange {
    public static func validate(status: Int, contentRange: String?, contentLength: Int64, offset: Int64) throws -> Int64 {
        if status == 200 && offset == 0 && contentLength > 0 { return contentLength }
        guard status == 206, let contentRange else { throw APIError.network("音频源未正确响应分段读取（HTTP \(status)）。") }
        let parts = contentRange.replacingOccurrences(of: "bytes ", with: "").split(separator: "/")
        guard parts.count == 2, let total = Int64(parts[1]), let rangeStart = parts[0].split(separator: "-").first.flatMap({ Int64($0) }), rangeStart == offset, total > offset else { throw APIError.invalidResponse }
        return total
    }
    public static func fetch(url: URL, headers: [String: String], offset: Int64, length: Int, session: URLSession = .shared, onFirstByte: @Sendable () -> Void = {}, priority: Float = URLSessionTask.defaultPriority) async throws -> AudioChunk {
        try await stream(url: url, headers: headers, offset: offset, length: length, session: session, onFirstByte: onFirstByte, priority: priority) { _ in }
    }
    public static func stream(url: URL, headers: [String: String], offset: Int64, length: Int, session: URLSession,
                              onFirstByte: @Sendable () -> Void = {}, priority: Float = URLSessionTask.defaultPriority,
                              receive: @escaping @Sendable (AudioChunk) async throws -> Void) async throws -> AudioChunk {
        guard offset >= 0, length > 0, offset <= Int64.max - Int64(length), url.scheme == "https" || url.host == "127.0.0.1" else { throw APIError.invalidResponse }
        try Task.checkCancellation()
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        request.setValue("bytes=\(offset)-\(offset + Int64(length) - 1)", forHTTPHeaderField: "Range")
        let (bytes, response) = try await session.bytes(for: request)
        bytes.task.priority = priority
        defer { bytes.task.cancel() }
        guard let response = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        let total = try validate(status: response.statusCode, contentRange: response.value(forHTTPHeaderField: "Content-Range"), contentLength: response.expectedContentLength, offset: offset)
        let expected = Int(min(Int64(length), total - offset))
        var data = Data(); data.reserveCapacity(expected)
        var delivered = 0
        for try await byte in bytes {
            try Task.checkCancellation()
            if data.isEmpty { onFirstByte() }
            data.append(byte)
            if data.count - delivered >= 16_384 || data.count == expected {
                try await receive(AudioChunk(data: data.subdata(in: delivered..<data.count), offset: offset + Int64(delivered), total: total))
                delivered = data.count
            }
            if data.count == expected { break }
        }
        guard data.count == expected else { throw APIError.network("音频分段不完整，请重试。") }
        return AudioChunk(data: data, offset: offset, total: total)
    }
}
