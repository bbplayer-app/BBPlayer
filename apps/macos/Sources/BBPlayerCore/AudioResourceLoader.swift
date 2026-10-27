import Foundation
import AVFoundation
import UniformTypeIdentifiers

actor AudioChunkRequests {
    static let chunkSize = 262_144
    struct Subscription: Sendable { let id: UUID; let stream: AsyncThrowingStream<AudioChunk, Error> }
    private struct Request {
        let generation: UUID
        var listeners: [UUID: AsyncThrowingStream<AudioChunk, Error>.Continuation]
        var data = Data()
        var total: Int64 = 0
        var task: Task<Void, Never>?
    }
    private let source: ResolvedAudio
    private let cache: AudioCache
    private let session: URLSession
    private let onFirstByte: @Sendable () -> Void
    private let onForeground: @Sendable () -> Void
    private var requests: [Int64: Request] = [:]
    private var recent: [AudioChunk] = []
    private var stopped = false
    static func cacheKey(_ source: ResolvedAudio) -> String { source.track.id + ":" + source.url.path }
    init(source: ResolvedAudio, cache: AudioCache, onFirstByte: @escaping @Sendable () -> Void, onForeground: @escaping @Sendable () -> Void) {
        self.source = source; self.cache = cache; self.onFirstByte = onFirstByte; self.onForeground = onForeground
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: config)
    }
    func subscribe(offset: Int64) async throws -> Subscription {
        try Task.checkCancellation()
        guard !stopped else { throw CancellationError() }
        let id = UUID()
        let pair = AsyncThrowingStream<AudioChunk, Error>.makeStream(bufferingPolicy: .bufferingNewest(32))
        if let chunk = recent.first(where: { $0.offset == offset }) {
            pair.continuation.yield(chunk); pair.continuation.finish()
            return Subscription(id: id, stream: pair.stream)
        }
        if let cached = try? await cache.read(key: Self.cacheKey(source), offset: offset),
           cached.data.count == Int(min(Int64(Self.chunkSize), cached.total - offset)) {
            pair.continuation.yield(cached); pair.continuation.finish()
            return Subscription(id: id, stream: pair.stream)
        }
        try Task.checkCancellation()
        guard !stopped else { throw CancellationError() }
        while requests[offset] == nil && requests.count >= 4 {
            try await Task.sleep(for: .milliseconds(5)); try Task.checkCancellation()
            guard !stopped else { throw CancellationError() }
        }
        if var request = requests[offset] {
            if !request.data.isEmpty { pair.continuation.yield(AudioChunk(data: request.data, offset: offset, total: request.total)) }
            request.listeners[id] = pair.continuation; requests[offset] = request
        } else {
            let generation = UUID()
            requests[offset] = Request(generation: generation, listeners: [id: pair.continuation])
            onForeground()
            let task = Task { [self] in
                do {
                    try Task.checkCancellation()
                    guard !stopped else { throw CancellationError() }
                    if ProcessInfo.processInfo.environment["BBPLAYER_RANGE_TRACE"] == "1" { print("fetch-chunk", offset) }
                    let complete = try await HTTPRange.stream(url: source.url, headers: source.headers, offset: offset, length: Self.chunkSize, session: session, onFirstByte: onFirstByte) { [self] chunk in
                        await publish(chunk, offset: offset, generation: generation)
                    }
                    try Task.checkCancellation()
                    if ProcessInfo.processInfo.environment["BBPLAYER_RANGE_TRACE"] == "1" { print("complete-chunk", offset, complete.total) }
                    cache.enqueueStore(complete, key: Self.cacheKey(source))
                    recent.removeAll { $0.offset == offset }; recent.append(complete)
                    if recent.count > 4 { recent.removeFirst() }
                    finish(offset: offset, generation: generation, error: nil)
                } catch { finish(offset: offset, generation: generation, error: error) }
            }
            requests[offset]?.task = task
        }
        pair.continuation.onTermination = { [weak self] termination in
            if case .cancelled = termination { Task { await self?.unsubscribe(offset: offset, id: id, cancelled: true) } }
        }
        return Subscription(id: id, stream: pair.stream)
    }
    private func publish(_ chunk: AudioChunk, offset: Int64, generation: UUID) {
        guard var request = requests[offset], request.generation == generation else { return }
        request.data.append(chunk.data); request.total = chunk.total
        requests[offset] = request
        for listener in request.listeners.values { listener.yield(chunk) }
    }
    private func finish(offset: Int64, generation: UUID, error: Error?) {
        guard let request = requests[offset], request.generation == generation else { return }
        requests.removeValue(forKey: offset)
        for listener in request.listeners.values { if let error { listener.finish(throwing: error) } else { listener.finish() } }
    }
    func unsubscribe(offset: Int64, id: UUID, cancelled: Bool) {
        guard var request = requests[offset] else { return }
        request.listeners.removeValue(forKey: id); requests[offset] = request
        if cancelled && request.listeners.isEmpty {
            let generation = request.generation
            // AVFoundation often replaces a request at a nearby offset immediately.
            // Keep one bounded transfer briefly so it can attach without downloading again.
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(150))
                await self?.cancelUnused(offset: offset, generation: generation)
            }
        }
    }
    private func cancelUnused(offset: Int64, generation: UUID) {
        guard let request = requests[offset], request.generation == generation, request.listeners.isEmpty else { return }
        request.task?.cancel(); requests.removeValue(forKey: offset)
    }
    func cancel() {
        stopped = true
        let tasks = requests.values.compactMap(\.task)
        for request in requests.values { request.task?.cancel(); request.listeners.values.forEach { $0.finish(throwing: CancellationError()) } }
        requests.removeAll(); recent.removeAll()
        Task { [session] in for task in tasks { await task.value }; session.invalidateAndCancel() }
    }
}

public final class AudioResourceLoader: NSObject, AVAssetResourceLoaderDelegate, @unchecked Sendable {
    public private(set) var asset: AVURLAsset
    public private(set) var isSegmented = false
    private let broker: AudioChunkRequests
    private let stateLock = NSLock()
    private var segmentServer: SegmentedAudioServer?
    private let onDelivery: @Sendable () -> Void
    private let queue = DispatchQueue(label: "com.bbplayer.macos.resource-loader")
    private var jobs: [ObjectIdentifier: Task<Void, Never>] = [:]
    public init(source: ResolvedAudio, cache: AudioCache, onFirstByte: @escaping @Sendable () -> Void = {}, onDelivery: @escaping @Sendable () -> Void = {}, onForeground: @escaping @Sendable () -> Void = {}) {
        broker = AudioChunkRequests(source: source, cache: cache, onFirstByte: onFirstByte, onForeground: onForeground)
        self.onDelivery = onDelivery
        asset = AVURLAsset(url: URL(string: "bbpaudio://stream/\(UUID().uuidString).m4a")!, options: [AVURLAssetPreferPreciseDurationAndTimingKey: false])
        super.init(); asset.resourceLoader.setDelegate(self, queue: queue)
    }
    /// Older systems keep the file path because they cannot tap HLS audio for the spectrum.
    public func prepareForPlayback() async throws {
        guard #available(macOS 27.0, *) else { return }
        let sub = try await broker.subscribe(offset: 0)
        var head = Data(), index: FragmentedAudioIndex?
        do {
            for try await chunk in sub.stream {
                try Task.checkCancellation()
                guard chunk.offset == Int64(head.count) else { break }
                head.append(chunk.data)
                if let parsed = FragmentedAudioIndex.parse(head, total: chunk.total) { index = parsed; break }
                guard let needed = FragmentedAudioIndex.requiredHeaderBytes(head), needed > head.count else { break }
            }
            await broker.unsubscribe(offset: 0, id: sub.id, cancelled: false)
        } catch {
            await broker.unsubscribe(offset: 0, id: sub.id, cancelled: true); throw error
        }
        guard let index else { return }
        let server = try SegmentedAudioServer(broker: broker, index: index, onDelivery: onDelivery)
        stateLock.withLock { segmentServer = server }
        do {
            let url = try await server.start()
            try Task.checkCancellation()
            asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: false])
            isSegmented = true
        } catch { server.cancel(); throw error }
    }
    public func resourceLoader(_ resourceLoader: AVAssetResourceLoader, shouldWaitForLoadingOfRequestedResource request: AVAssetResourceLoadingRequest) -> Bool {
        let id = ObjectIdentifier(request)
        if ProcessInfo.processInfo.environment["BBPLAYER_RANGE_TRACE"] == "1" { print("range-request", request.dataRequest?.requestedOffset ?? -1, request.dataRequest?.requestedLength ?? -1, request.dataRequest?.requestsAllDataToEndOfResource ?? false, request.contentInformationRequest != nil) }
        jobs[id] = Task { [self] in
            do {
                var offset = request.dataRequest.map { max($0.requestedOffset, $0.currentOffset) } ?? 0
                let requestedEnd = request.dataRequest.map { $0.requestsAllDataToEndOfResource ? Int64.max : $0.requestedOffset + Int64($0.requestedLength) } ?? offset
                var total = Int64.max
                repeat {
                    try Task.checkCancellation()
                    let previousOffset = offset
                    let aligned = (offset / Int64(AudioChunkRequests.chunkSize)) * Int64(AudioChunkRequests.chunkSize)
                    let subscription = try await broker.subscribe(offset: aligned)
                    do {
                        for try await chunk in subscription.stream {
                            try Task.checkCancellation()
                            total = chunk.total
                            let end = min(requestedEnd, total, chunk.offset + Int64(chunk.data.count))
                            let lower = Int(max(0, offset - chunk.offset)), upper = Int(end - chunk.offset)
                            await onQueue {
                                guard !request.isCancelled, !request.isFinished else { return }
                                if let info = request.contentInformationRequest {
                                    info.contentType = UTType.mpeg4Audio.identifier; info.contentLength = total; info.isByteRangeAccessSupported = true
                                }
                                if upper > lower, upper <= chunk.data.count {
                                    self.onDelivery(); request.dataRequest?.respond(with: chunk.data.subdata(in: lower..<upper))
                                }
                            }
                            offset = max(offset, end)
                            if request.dataRequest == nil || offset >= min(requestedEnd, total) { break }
                        }
                        await broker.unsubscribe(offset: aligned, id: subscription.id, cancelled: false)
                    } catch {
                        await broker.unsubscribe(offset: aligned, id: subscription.id, cancelled: true)
                        throw error
                    }
                    if request.dataRequest == nil { break }
                    guard offset > previousOffset else { throw APIError.invalidResponse }
                } while offset < min(requestedEnd, total)
                try Task.checkCancellation()
                await onQueue { if !request.isCancelled && !request.isFinished { request.finishLoading() } }
            } catch {
                await onQueue { if !request.isCancelled && !request.isFinished { request.finishLoading(with: error) } }
            }
            queue.async { self.jobs.removeValue(forKey: id) }
        }
        return true
    }
    public func resourceLoader(_ resourceLoader: AVAssetResourceLoader, didCancel request: AVAssetResourceLoadingRequest) { jobs.removeValue(forKey: ObjectIdentifier(request))?.cancel() }
    public func cancel() {
        stateLock.withLock { segmentServer?.cancel(); segmentServer = nil }
        queue.async { self.jobs.values.forEach { $0.cancel() }; self.jobs.removeAll(); Task { await self.broker.cancel() } }
    }
    private func onQueue(_ block: @escaping () -> Void) async { await withCheckedContinuation { continuation in queue.async { block(); continuation.resume() } } }
}
