import Foundation
import Network

/// Loopback-only view of indexed fragments. No remote URL, cookie, or audio file is exposed.
final class SegmentedAudioServer: @unchecked Sendable {
    private let listener: NWListener
    private let queue = DispatchQueue(label: "com.bbplayer.macos.fragment-server")
    private let broker: AudioChunkRequests
    private let index: FragmentedAudioIndex
    private let onDelivery: @Sendable () -> Void
    private let token = UUID().uuidString
    private var connections: [UUID: NWConnection] = [:]
    private var tasks: [UUID: Task<Void, Never>] = [:]
    private var stopped = false
    init(broker: AudioChunkRequests, index: FragmentedAudioIndex, onDelivery: @escaping @Sendable () -> Void) throws {
        self.broker = broker; self.index = index; self.onDelivery = onDelivery
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        listener = try NWListener(using: parameters)
    }
    func start() async throws -> URL {
        try Task.checkCancellation()
        return try await withCheckedThrowingContinuation { continuation in
            queue.async { [self] in
                var answered = false
                listener.stateUpdateHandler = { [weak self] state in
                    guard let self, !answered else { return }
                    if case .ready = state, let port = self.listener.port {
                        answered = true
                        continuation.resume(returning: URL(string: "http://127.0.0.1:\(port.rawValue)/\(self.token)/playlist.m3u8")!)
                    } else if case .failed(let error) = state {
                        answered = true; continuation.resume(throwing: error)
                    } else if case .cancelled = state {
                        answered = true; continuation.resume(throwing: CancellationError())
                    }
                }
                listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
                listener.start(queue: queue)
            }
        }
    }
    private func accept(_ connection: NWConnection) {
        guard !stopped, connections.count < 6 else { connection.cancel(); return }
        let id = UUID(); connections[id] = connection
        connection.stateUpdateHandler = { [weak self] state in
            if case .failed = state { self?.tasks[id]?.cancel() }
            if case .cancelled = state { self?.tasks[id]?.cancel() }
        }
        connection.start(queue: queue)
        tasks[id] = Task { [weak self] in
            guard let self else { return }
            do { try await serve(connection) } catch { /* Cancellation and connection loss only end this request. */ }
            connection.cancel()
            queue.async { self.connections.removeValue(forKey: id); self.tasks.removeValue(forKey: id) }
        }
    }
    private func serve(_ connection: NWConnection) async throws {
        var request = Data()
        while request.range(of: Data("\r\n\r\n".utf8)) == nil {
            guard request.count < 8192 else { return }
            request.append(try await receive(connection))
        }
        let lines = String(decoding: request, as: UTF8.self).components(separatedBy: "\r\n")
        let first = lines[0].split(separator: " ")
        guard first.count == 3, first[0] == "GET" || first[0] == "HEAD", first[1].hasPrefix("/\(token)/") else { return }
        let path = String(first[1].dropFirst(token.count + 2))
        if ProcessInfo.processInfo.environment["BBPLAYER_RANGE_TRACE"] == "1" { print("fragment-request", path) }
        if path == "playlist.m3u8" {
            let body = index.playlist
            try await send(connection, Data("HTTP/1.1 200 OK\r\nContent-Type: application/vnd.apple.mpegurl\r\nCache-Control: no-store\r\nContent-Length: \(body.count)\r\nConnection: close\r\n\r\n".utf8))
            if first[0] == "GET" { try await send(connection, body) }
            return
        }
        let resourceOffset: Int64, resourceLength: Int64
        if path == "init.mp4" { resourceOffset = 0; resourceLength = index.initializationLength }
        else if path.hasPrefix("segment/"), path.hasSuffix(".m4s"),
                let number = Int(path.dropFirst(8).dropLast(4)), index.segments.indices.contains(number) {
            let segment = index.segments[number]; resourceOffset = segment.offset; resourceLength = segment.length
        } else { return }
        var lower: Int64 = 0, upper = resourceLength
        let range = lines.dropFirst().first { $0.lowercased().hasPrefix("range:") }
        if let range {
            let value = range.dropFirst(6).trimmingCharacters(in: .whitespaces)
            guard value.hasPrefix("bytes=") else { return }
            let bounds = value.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
            guard bounds.count == 2, let start = Int64(bounds[0]), start >= 0, start < resourceLength else { return }
            lower = start
            if !bounds[1].isEmpty { guard let end = Int64(bounds[1]), end >= lower, end < Int64.max else { return }; upper = min(resourceLength, end+1) }
        }
        let status = range == nil ? "200 OK" : "206 Partial Content"
        let rangeHeader = range == nil ? "" : "Content-Range: bytes \(lower)-\(upper-1)/\(resourceLength)\r\n"
        try await send(connection, Data("HTTP/1.1 \(status)\r\nContent-Type: audio/mp4\r\nCache-Control: no-store\r\nAccept-Ranges: bytes\r\n\(rangeHeader)Content-Length: \(upper-lower)\r\nConnection: close\r\n\r\n".utf8))
        guard first[0] == "GET" else { return }
        var offset = resourceOffset + lower
        let end = resourceOffset + upper
        while offset < end {
            try Task.checkCancellation()
            let aligned = offset / Int64(AudioChunkRequests.chunkSize) * Int64(AudioChunkRequests.chunkSize)
            let sub = try await broker.subscribe(offset: aligned)
            let before = offset
            do {
                for try await chunk in sub.stream {
                    try Task.checkCancellation()
                    let next = min(end, chunk.offset + Int64(chunk.data.count))
                    if next > offset, offset >= chunk.offset {
                        let data = chunk.data.subdata(in: Int(offset-chunk.offset)..<Int(next-chunk.offset))
                        onDelivery(); try await send(connection, data); offset = next
                    }
                    if offset >= end { break }
                }
                await broker.unsubscribe(offset: aligned, id: sub.id, cancelled: false)
            } catch {
                await broker.unsubscribe(offset: aligned, id: sub.id, cancelled: true); throw error
            }
            guard offset > before else { throw APIError.invalidResponse }
        }
    }
    private func receive(_ connection: NWConnection) async throws -> Data {
        try Task.checkCancellation()
        return try await withCheckedThrowingContinuation { continuation in
            connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, _, complete, error in
                if let error { continuation.resume(throwing: error) }
                else if let data, !data.isEmpty { continuation.resume(returning: data) }
                else { continuation.resume(throwing: complete ? CancellationError() : APIError.invalidResponse) }
            }
        }
    }
    private func send(_ connection: NWConnection, _ data: Data) async throws {
        try Task.checkCancellation()
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, completion: .contentProcessed { error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            })
        }
    }
    func cancel() {
        queue.async { [self] in
            stopped = true; listener.cancel()
            tasks.values.forEach { $0.cancel() }; connections.values.forEach { $0.cancel() }
            tasks.removeAll(); connections.removeAll()
        }
    }
}
