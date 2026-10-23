import Foundation

public struct AudioChunk: Codable, Sendable {
    public var data: Data
    public var offset: Int64
    public var total: Int64
    public init(data: Data, offset: Int64, total: Int64) { self.data = data; self.offset = offset; self.total = total }
}

public actor AudioCache {
    public let root: URL
    public var limit: Int64
    private var active: [String: Int] = [:]
    public init(root: URL, limit: Int64 = 1_073_741_824) throws {
        self.root = root; self.limit = limit
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }
    public func setLimit(_ value: Int64) throws { limit = max(0, value); try evict() }
    public func pin(_ key: String) { active[Self.digest(key), default: 0] += 1 }
    public func unpin(_ key: String) {
        let digest = Self.digest(key), remaining = (active[digest] ?? 0) - 1
        if remaining <= 0 { active.removeValue(forKey: digest) } else { active[digest] = remaining }
        try? evict()
    }
    private static func digest(_ key: String) -> String { WBI.md5(Data(key.utf8)) }
    private func path(key: String, offset: Int64) -> URL { root.appendingPathComponent("\(Self.digest(key))-\(offset).chunk") }
    public func read(key: String, offset: Int64) throws -> AudioChunk? {
        let url = path(key: key, offset: offset)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        do {
            let chunk = try JSONDecoder().decode(AudioChunk.self, from: Data(contentsOf: url))
            guard chunk.offset == offset, chunk.total > offset, Int64(chunk.data.count) <= chunk.total - offset, !chunk.data.isEmpty else { try? FileManager.default.removeItem(at: url); return nil }
            try FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
            return chunk
        } catch { try? FileManager.default.removeItem(at: url); return nil }
    }
    public func store(_ chunk: AudioChunk, key: String) throws {
        guard limit > 0, !chunk.data.isEmpty else { return }
        try JSONEncoder().encode(chunk).write(to: path(key: key, offset: chunk.offset), options: .atomic)
        try evict()
        // A long active resource must not grow the cache beyond its configured budget.
        if try size() > limit { try? FileManager.default.removeItem(at: path(key: key, offset: chunk.offset)) }
    }
    public func size() throws -> Int64 {
        try files().reduce(0) { $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    }
    public func clear() throws {
        for file in try files() where active[String(file.lastPathComponent.prefix(32))] == nil { try FileManager.default.removeItem(at: file) }
    }
    private func files() throws -> [URL] {
        try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]).filter { $0.pathExtension == "chunk" }
    }
    private func evict() throws {
        let files = try files().sorted { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) < ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }
        var bytes = try size()
        for file in files where bytes > limit && active[String(file.lastPathComponent.prefix(32))] == nil {
            let length = Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
            try FileManager.default.removeItem(at: file); bytes -= length
        }
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
    public static func fetch(url: URL, headers: [String: String], offset: Int64, length: Int, session: URLSession = .shared) async throws -> AudioChunk {
        guard offset >= 0, length > 0, url.scheme == "https" || url.host == "127.0.0.1" else { throw APIError.invalidResponse }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        request.setValue("bytes=\(offset)-\(offset + Int64(length) - 1)", forHTTPHeaderField: "Range")
        let (bytes, response) = try await session.bytes(for: request)
        guard let response = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        let total = try validate(status: response.statusCode, contentRange: response.value(forHTTPHeaderField: "Content-Range"), contentLength: response.expectedContentLength, offset: offset)
        let expected = min(length, Int(total - offset))
        var data = Data(); data.reserveCapacity(expected)
        for try await byte in bytes {
            try Task.checkCancellation()
            data.append(byte)
            if data.count == expected { break }
        }
        guard data.count == expected else { throw APIError.network("音频分段不完整，请重试。") }
        return AudioChunk(data: data, offset: offset, total: total)
    }
}
