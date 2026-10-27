import Foundation

public enum AudioPrefetch {
    public static let maximumBytes = 1_048_576
    public static func expiry(for source: ResolvedAudio, now: Date = Date()) -> Date {
        if let deadline = URLComponents(url: source.url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "deadline" })?.value.flatMap(Double.init) {
            return Date(timeIntervalSince1970: deadline - 30)
        }
        return now.addingTimeInterval(120)
    }
    /// At most three head chunks and one tail chunk; overlapping ranges are not fetched twice.
    public static func fill(source: ResolvedAudio, cache: AudioCache, maximumBytes: Int = maximumBytes) async throws -> Int {
        guard cache.limit > 0, maximumBytes > 0 else { return 0 }
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let key = AudioChunkRequests.cacheKey(source)
        var offsets: [Int64] = [0], seen = Set<Int64>(), received = 0
        while !offsets.isEmpty && received < maximumBytes {
            try Task.checkCancellation()
            let offset = offsets.removeFirst()
            guard seen.insert(offset).inserted else { continue }
            let chunk: AudioChunk
            if let cached = try? await cache.read(key: key, offset: offset) { chunk = cached }
            else {
                chunk = try await HTTPRange.fetch(url: source.url, headers: source.headers, offset: offset, length: min(AudioChunkRequests.chunkSize, maximumBytes - received), session: session, priority: URLSessionTask.lowPriority)
                received += chunk.data.count
                cache.enqueueStore(chunk, key: key)
            }
            if offset == 0 {
                let size = Int64(AudioChunkRequests.chunkSize)
                offsets = [size, size * 2, ((chunk.total - 1) / size) * size].filter { $0 < chunk.total }
            }
        }
        return received
    }
}
