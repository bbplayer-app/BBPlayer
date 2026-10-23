import Foundation
import AVFoundation
import UniformTypeIdentifiers

public final class AudioResourceLoader: NSObject, AVAssetResourceLoaderDelegate, @unchecked Sendable {
    public let asset: AVURLAsset
    private let source: ResolvedAudio
    private let cache: AudioCache
    private let key: String
    private let session: URLSession
    private let queue = DispatchQueue(label: "com.bbplayer.macos.resource-loader")
    private var jobs: [ObjectIdentifier: Task<Void, Never>] = [:]
    private static let chunkSize = 262_144
    public init(source: ResolvedAudio, cache: AudioCache) {
        self.source = source; self.cache = cache
        key = source.track.id + ":" + source.url.path
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: configuration)
        asset = AVURLAsset(url: URL(string: "bbpaudio://stream/\(UUID().uuidString).m4a")!)
        super.init()
        asset.resourceLoader.setDelegate(self, queue: queue)
    }
    public func resourceLoader(_ resourceLoader: AVAssetResourceLoader, shouldWaitForLoadingOfRequestedResource request: AVAssetResourceLoadingRequest) -> Bool {
        let id = ObjectIdentifier(request)
        jobs[id] = Task { [self] in
            await cache.pin(key)
            do {
                var offset = request.dataRequest.map { max($0.requestedOffset, $0.currentOffset) } ?? 0
                let requestedEnd: Int64 = request.dataRequest.map { $0.requestsAllDataToEndOfResource ? Int64.max : $0.requestedOffset + Int64($0.requestedLength) } ?? offset
                var total = Int64.max
                repeat {
                    try Task.checkCancellation()
                    let aligned = (offset / Int64(Self.chunkSize)) * Int64(Self.chunkSize)
                    let chunk: AudioChunk
                    if let cached = try await cache.read(key: key, offset: aligned) { chunk = cached }
                    else {
                        chunk = try await HTTPRange.fetch(url: source.url, headers: source.headers, offset: aligned, length: Self.chunkSize, session: session)
                        try await cache.store(chunk, key: key)
                    }
                    total = chunk.total
                    let end = min(requestedEnd, total, chunk.offset + Int64(chunk.data.count))
                    let lower = Int(offset - chunk.offset), upper = Int(end - chunk.offset)
                    try await onQueue {
                        guard !request.isCancelled, !request.isFinished else { return }
                        if let info = request.contentInformationRequest {
                            info.contentType = UTType.mpeg4Audio.identifier
                            info.contentLength = total
                            info.isByteRangeAccessSupported = true
                        }
                        if lower >= 0, upper > lower, upper <= chunk.data.count { request.dataRequest?.respond(with: chunk.data.subdata(in: lower..<upper)) }
                    }
                    if request.dataRequest == nil { break }
                    guard end > offset else { throw APIError.invalidResponse }
                    offset = end
                } while offset < min(requestedEnd, total)
                try Task.checkCancellation()
                try await onQueue { if !request.isCancelled && !request.isFinished { request.finishLoading() } }
            } catch {
                try? await onQueue { if !request.isCancelled && !request.isFinished { request.finishLoading(with: error) } }
            }
            await cache.unpin(key)
            queue.async { self.jobs.removeValue(forKey: id) }
        }
        return true
    }
    public func resourceLoader(_ resourceLoader: AVAssetResourceLoader, didCancel request: AVAssetResourceLoadingRequest) {
        jobs.removeValue(forKey: ObjectIdentifier(request))?.cancel()
    }
    public func cancel() { queue.async { self.jobs.values.forEach { $0.cancel() }; self.jobs.removeAll(); self.session.invalidateAndCancel() } }
    private func onQueue(_ block: @escaping () -> Void) async throws {
        await withCheckedContinuation { continuation in queue.async { block(); continuation.resume() } }
    }
}
