import XCTest
import AVFoundation
@testable import BBPlayerCore

private final class RangeFixture {
    let process = Process()
    let port: Int
    init(audio: URL, rate: Int = 250_000, rtt: Double = 0.1, total: Int64? = nil) throws {
        let script = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("scripts/streaming-fixture.py")
        let output = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = ["-u", script.path, "--audio", audio.path, "--rate", String(rate), "--rtt", String(rtt)]
        if let total { process.arguments! += ["--total", String(total)] }
        process.standardOutput = output; process.standardError = FileHandle.nullDevice
        try process.run()
        port = Int(String(decoding: output.fileHandleForReading.availableData, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines))!
    }
    func url(_ name: String = "audio") -> URL { URL(string: "http://127.0.0.1:\(port)/\(name).m4a")! }
    func stats() async throws -> [[String: Any]] {
        let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:\(port)/stats")!)
        return try JSONSerialization.jsonObject(with: data) as! [[String: Any]]
    }
    func setPaused(_ paused: Bool) async throws {
        _ = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:\(port)/control?paused=\(paused ? 1 : 0)")!)
    }
    deinit { if process.isRunning { process.terminate(); process.waitUntilExit() } }
}
private actor StreamProvider: MediaSourceProvider {
    let server: RangeFixture
    let chapterDelay: Duration
    let urlLifetime: Double?
    let prefetchDelay: Duration
    let rejectPrefetch: Bool
    var resolved: [String] = []
    init(_ server: RangeFixture, chapterDelay: Duration = .zero, urlLifetime: Double? = nil, prefetchDelay: Duration = .zero, rejectPrefetch: Bool = false) {
        self.server = server; self.chapterDelay = chapterDelay; self.urlLifetime = urlLifetime
        self.prefetchDelay = prefetchDelay; self.rejectPrefetch = rejectPrefetch
    }
    func search(_ query: String, page: Int) async throws -> [Track] { [] }
    func resolve(_ track: Track) async throws -> ResolvedAudio {
        resolved.append(track.id)
        if resolved.count > 1 {
            if rejectPrefetch { throw APIError.network("Optional preparation failed") }
            // Simulate a provider that returns after cancellation; the caller must reject it.
            try? await Task.sleep(for: prefetchDelay)
        }
        var url = server.url(track.bvid)
        if let urlLifetime { url = URL(string: url.absoluteString + "?deadline=\(Date().timeIntervalSince1970 + urlLifetime + 30)")! }
        return ResolvedAudio(track: track, url: url)
    }
    func chapters(for track: Track) async throws -> [Chapter] {
        try await Task.sleep(for: chapterDelay)
        return [Chapter(title: track.title, start: 0, end: 10)]
    }
}
final class StreamingTests: XCTestCase {
    private func root() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("bbplayer-stream-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    private func audio(_ root: URL) throws -> URL {
        let url = root.appendingPathComponent("fixture.m4a")
        let file = try AVAudioFile(forWriting: url, settings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 192000])
        let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 4800)!
        buffer.frameLength = 4800
        for channel in 0..<2 { for frame in 0..<4800 { buffer.floatChannelData![channel][frame] = sin(Float(frame) * 2 * .pi * 440 / 48000) * 0.2 } }
        for _ in 0..<900 { try file.write(from: buffer) }
        return url
    }
    private func indexedAudio(_ root: URL) throws -> URL {
        let ffmpeg = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].first { FileManager.default.isExecutableFile(atPath: $0) }
        guard let ffmpeg else { throw XCTSkip("Indexed fMP4 acceptance requires the optional ffmpeg fixture generator") }
        let input = try audio(root), output = root.appendingPathComponent("indexed.m4a")
        let process = Process(); process.executableURL = URL(fileURLWithPath: ffmpeg)
        process.arguments = ["-hide_banner", "-loglevel", "error", "-y", "-i", input.path, "-c:a", "copy", "-movflags", "dash+global_sidx", "-frag_duration", "5000000", output.path]
        process.standardError = FileHandle.nullDevice
        try process.run(); process.waitUntilExit(); XCTAssertEqual(process.terminationStatus, 0)
        return output
    }
    func testRollingCacheWithLargeOffsetsAndActiveChunk() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let cache = try AudioCache(root: root, limit: 4000)
        let total: Int64 = 4_294_967_296
        try await cache.store(AudioChunk(data: Data(repeating: 1, count: 1024), offset: 0, total: total), key: "long")
        await cache.pin("long", offset: 0)
        for offset in 1...12 { try await cache.store(AudioChunk(data: Data(repeating: UInt8(offset), count: 1024), offset: Int64(offset) * 262_144, total: total), key: "long") }
        let first = try await cache.read(key: "long", offset: 0)
        XCTAssertNotNil(first)
        await cache.unpin("long", offset: 0)
        let far: Int64 = 2_147_483_648
        try await cache.store(AudioChunk(data: Data(repeating: 9, count: 1024), offset: far, total: total), key: "long")
        let found = try await cache.read(key: "long", offset: far)
        XCTAssertEqual(found?.total, total)
        let size = try await cache.size(); XCTAssertLessThanOrEqual(size, 4000)
        try await cache.setLimit(1000)
        let reduced = try await cache.size(); XCTAssertLessThanOrEqual(reduced, 1000)
        try await cache.setLimit(0)
        let empty = try await cache.size(); XCTAssertEqual(empty, 0)
    }
    func testPendingWritesAreBoundedAndSlowWriterDoesNotBlockReads() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let cache = try AudioCache(root: root, limit: 32 * 1024 * 1024, writeDelay: 0.05)
        let chunk = AudioChunk(data: Data(repeating: 1, count: 262_144), offset: 0, total: 262_144)
        var accepted = 0
        for _ in 0..<80 { if cache.enqueueStore(chunk, key: UUID().uuidString) { accepted += 1 } }
        XCTAssertLessThan(accepted, 80)
        XCTAssertLessThanOrEqual(cache.pendingWriteBytes, AudioCache.maximumPendingBytes)
        let start = Date()
        _ = try await cache.read(key: "missing", offset: 0)
        XCTAssertLessThan(Date().timeIntervalSince(start), 0.2)
        await cache.flush()
    }
    func testStreamingDeliversBeforeFullChunkAndPrefetchIsBounded() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root))
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        let start = ProcessInfo.processInfo.systemUptime
        let first = LockedTime()
        _ = try await HTTPRange.stream(url: server.url(), headers: [:], offset: 0, length: 262_144, session: session) { _ in first.record(ProcessInfo.processInfo.systemUptime - start) }
        let completed = ProcessInfo.processInfo.systemUptime - start
        XCTAssertLessThan(try XCTUnwrap(first.value), completed - 0.3)
        let cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let source = ResolvedAudio(track: Track(bvid: "prefetch", title: "Fixture"), url: server.url("prefetch"))
        let received = try await AudioPrefetch.fill(source: source, cache: cache)
        XCTAssertLessThanOrEqual(received, AudioPrefetch.maximumBytes)
        XCTAssertGreaterThan(received, 0)
        await cache.flush()
        try await cache.setLimit(0)
        let disabled = try await AudioPrefetch.fill(source: source, cache: cache)
        XCTAssertEqual(disabled, 0)
    }
    @MainActor private func waitForClock(_ engine: NativePlaybackEngine) async throws -> Double {
        let start = ProcessInfo.processInfo.systemUptime
        var first: Double?
        for _ in 0..<600 {
            try await Task.sleep(for: .milliseconds(10))
            if engine.renderPosition >= 0.05 && first == nil { first = ProcessInfo.processInfo.systemUptime - start }
            if engine.renderPosition >= 0.55 { return try XCTUnwrap(first) }
            if let error = engine.errorMessage { XCTFail(error); break }
        }
        XCTFail("Media clock did not advance: \(engine.diagnostics)")
        return 99
    }
    @MainActor func testFiveColdStartsAndFiveSwitchesAtTwoMegabits() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root))
        var times: [Double] = []
        for run in 0..<5 {
            let path = root.appendingPathComponent("run\(run)")
            let db = try LibraryDatabase(url: path.appendingPathComponent("db")), cache = try AudioCache(root: path.appendingPathComponent("cache"), writeDelay: 0.2)
            let engine = NativePlaybackEngine(provider: StreamProvider(server, chapterDelay: .seconds(20)), database: db, cache: cache, restore: false)
            defer { engine.shutdown() }
            engine.preferences.volume = 0; engine.preferences.prefetchNextTrack = false
            let a = Track(bvid: "a\(run)", title: "A", duration: 90), b = Track(bvid: "b\(run)", title: "B", duration: 90)
            engine.setQueue([a, b])
            let cold = try await waitForClock(engine); times.append(cold)
            engine.next()
            let switched = try await waitForClock(engine); times.append(switched)
            XCTAssertLessThanOrEqual(cold, 2)
            XCTAssertLessThanOrEqual(switched, 2)
            XCTAssertTrue(engine.chapters.isEmpty, "Slow chapters must not block playback")
            engine.pause()
        }
        print("Controlled cold/switch seconds:", times)
    }
    @MainActor func testPrefetchUsesNextTrackAndDoesNotCreateHistory() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root), rate: 4_000_000, rtt: 0.01)
        let provider = StreamProvider(server)
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        defer { engine.shutdown() }
        engine.preferences.volume = 0
        let tracks = (0..<3).map { Track(bvid: "song\($0)", title: "Song", duration: 90) }
        engine.setQueue(tracks)
        _ = try await waitForClock(engine)
        for _ in 0..<700 { if await provider.resolved.count >= 2 { break }; try await Task.sleep(for: .milliseconds(10)) }
        let resolved = await provider.resolved
        XCTAssertEqual(resolved, [tracks[0].id, tracks[1].id])
        XCTAssertEqual(engine.currentTrack?.id, tracks[0].id)
        XCTAssertFalse(try db.recentTracks().contains { $0.id == tracks[1].id })
        try await Task.sleep(for: .milliseconds(700))
        engine.next()
        let switched = try await waitForClock(engine)
        XCTAssertLessThanOrEqual(switched, 2)
        let resolutionCount = await provider.resolved.count; XCTAssertEqual(resolutionCount, 2)
    }
    func testPrefetchExpiryAndLegacyPreferences() throws {
        let track = Track(bvid: "fixture", title: "Fixture")
        let now = Date(timeIntervalSince1970: 1000)
        let source = ResolvedAudio(track: track, url: URL(string: "https://example.com/audio?deadline=1040")!)
        XCTAssertEqual(AudioPrefetch.expiry(for: source, now: now), now.addingTimeInterval(10))
        var raw = try JSONSerialization.jsonObject(with: JSONEncoder().encode(PlayerPreferences())) as! [String: Any]
        raw.removeValue(forKey: "prefetchNextTrack")
        let old = try JSONDecoder().decode(PlayerPreferences.self, from: JSONSerialization.data(withJSONObject: raw))
        XCTAssertTrue(old.prefetchNextTrack != false)
        XCTAssertEqual(AudioPrefetch.expiry(for: ResolvedAudio(track: track, url: URL(string: "https://example.com/audio")!), now: now), now.addingTimeInterval(120))
    }

    func testEvictedChunksRefetchAndLargeHTTPRangeOffsets() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let total: Int64 = 4_294_967_296
        let server = try RangeFixture(audio: audio(root), rate: 20_000_000, rtt: 0.001, total: total)
        let cache = try AudioCache(root: root.appendingPathComponent("cache"), limit: 400_000)
        let source = ResolvedAudio(track: Track(bvid: "large", title: "Large"), url: server.url())
        let broker = AudioChunkRequests(source: source, cache: cache, onFirstByte: {}, onForeground: {})
        func read(_ offset: Int64) async throws -> Int {
            let sub = try await broker.subscribe(offset: offset)
            var count = 0
            for try await chunk in sub.stream { XCTAssertEqual(chunk.total, total); count += chunk.data.count }
            return count
        }
        for index in 0..<6 { let count = try await read(Int64(index) * 262_144); XCTAssertEqual(count, 262_144) }
        await cache.flush()
        let missing = try await cache.read(key: AudioChunkRequests.cacheKey(source), offset: 0); XCTAssertNil(missing)
        let count = try await read(0); XCTAssertEqual(count, 262_144)
        let stats = try await server.stats()
        XCTAssertEqual(stats.filter { ($0["offset"] as? Int) == 0 }.count, 2)
        let far = try await HTTPRange.fetch(url: server.url(), headers: [:], offset: 2_147_483_648, length: 262_144)
        XCTAssertEqual(far.offset, 2_147_483_648); XCTAssertEqual(far.total, total); XCTAssertEqual(far.data.count, 262_144)
        await broker.cancel()
        let size = try await cache.size(); XCTAssertLessThanOrEqual(size, 400_000)
    }

    func testLowerLimitTrimsAfterActiveReadAndCacheFailureDoesNotFailStream() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let path = root.appendingPathComponent("cache")
        let cache = try AudioCache(root: path, limit: 4000)
        try await cache.store(AudioChunk(data: Data(repeating: 1, count: 1024), offset: 0, total: 1024), key: "active")
        await cache.pin("active", offset: 0)
        try await cache.setLimit(0)
        let pinned = try await cache.size(); XCTAssertGreaterThan(pinned, 0)
        await cache.unpin("active", offset: 0); await cache.flush()
        let cleared = try await cache.size(); XCTAssertEqual(cleared, 0)
        try await cache.setLimit(1_048_576)
        try FileManager.default.removeItem(at: path); try Data([0]).write(to: path)
        let server = try RangeFixture(audio: audio(root), rate: 20_000_000, rtt: 0.001)
        let source = ResolvedAudio(track: Track(bvid: "write-failure", title: "Fixture"), url: server.url())
        let broker = AudioChunkRequests(source: source, cache: cache, onFirstByte: {}, onForeground: {})
        let sub = try await broker.subscribe(offset: 0)
        var count = 0
        for try await chunk in sub.stream { count += chunk.data.count }
        XCTAssertEqual(count, 262_144)
        await cache.flush(); await broker.cancel()
    }

    @MainActor func testLateChaptersAndRapidSwitchesCannotUpdateAnotherTrack() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root), rate: 4_000_000, rtt: 0.01)
        let provider = StreamProvider(server, chapterDelay: .milliseconds(800))
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        defer { engine.shutdown() }; engine.preferences.volume = 0; engine.preferences.prefetchNextTrack = false
        let tracks = (0..<8).map { Track(bvid: "rapid\($0)", title: "Chapter \($0)", duration: 90) }
        engine.setQueue(tracks)
        for index in 1..<tracks.count { try await Task.sleep(for: .milliseconds(60)); engine.skip(to: index) }
        _ = try await waitForClock(engine)
        engine.pause()
        try await Task.sleep(for: .seconds(1))
        XCTAssertEqual(engine.currentTrack?.id, tracks.last?.id)
        XCTAssertEqual(engine.chapters.first?.title, tracks.last?.title)
        XCTAssertFalse(engine.isPlaying); XCTAssertFalse(engine.isPlaybackRequested)
        XCTAssertNil(engine.errorMessage)
    }

    @MainActor func testBufferRecoveryHonorsPlaybackAndPauseIntent() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root), rate: 80_000, rtt: 0.05)
        for pause in [false, true] {
            let path = root.appendingPathComponent("recovery\(pause)")
            let db = try LibraryDatabase(url: path.appendingPathComponent("db")), cache = try AudioCache(root: path.appendingPathComponent("cache"))
            let engine = NativePlaybackEngine(provider: StreamProvider(server), database: db, cache: cache, restore: false)
            defer { engine.shutdown() }; engine.preferences.volume = 0; engine.preferences.prefetchNextTrack = false
            try await server.setPaused(false)
            engine.setQueue([Track(bvid: "recover\(pause)", title: "Recovery", duration: 90)])
            _ = try await waitForClock(engine)
            try await server.setPaused(true)
            var stalled = false
            for _ in 0..<150 {
                try await Task.sleep(for: .milliseconds(100))
                if !engine.isPlaying { stalled = true; break }
            }
            XCTAssertTrue(stalled, "Fixture must actually exhaust the playback buffer")
            let before = engine.renderPosition
            if pause { engine.pause() }
            try await server.setPaused(false)
            try await Task.sleep(for: .seconds(2))
            if pause {
                XCTAssertFalse(engine.isPlaying); XCTAssertFalse(engine.isPlaybackRequested)
                XCTAssertEqual(engine.renderPosition, before, accuracy: 0.08)
            } else {
                XCTAssertTrue(engine.isPlaybackRequested); XCTAssertGreaterThan(engine.renderPosition, before + 0.3)
            }
            XCTAssertNil(engine.errorMessage)
            engine.shutdown()
        }
    }

    @MainActor func testExpiredPrefetchResolvesAgainAndQueueModesChooseActualNext() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root), rate: 10_000_000, rtt: 0.001)
        for mode in ["expiry", "shuffle", "wrap", "single"] {
            let path = root.appendingPathComponent(mode)
            let provider = StreamProvider(server, urlLifetime: mode == "expiry" ? 1 : nil)
            let db = try LibraryDatabase(url: path.appendingPathComponent("db")), cache = try AudioCache(root: path.appendingPathComponent("cache"))
            let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
            defer { engine.shutdown() }; engine.preferences.volume = 0
            let tracks = (0..<3).map { Track(bvid: "\(mode)\($0)", title: "Song", duration: 90) }
            if mode == "shuffle" { engine.toggleShuffle() }
            if mode == "single" { engine.setRepeat(.track) }
            engine.setQueue(tracks, index: mode == "wrap" ? 2 : 0)
            _ = try await waitForClock(engine)
            for _ in 0..<500 { if await provider.resolved.count >= 2 { break }; try await Task.sleep(for: .milliseconds(10)) }
            let resolved = await provider.resolved
            if mode == "single" { XCTAssertEqual(resolved.count, 1); engine.shutdown(); continue }
            XCTAssertEqual(resolved.count, 2)
            let expected = try XCTUnwrap(resolved.last)
            if mode == "wrap" { XCTAssertEqual(expected, tracks[0].id) }
            if mode == "expiry" { try await Task.sleep(for: .milliseconds(1300)) }
            engine.next(); _ = try await waitForClock(engine)
            XCTAssertEqual(engine.currentTrack?.id, expected)
            let count = await provider.resolved.count
            XCTAssertEqual(count, mode == "expiry" ? 3 : 2)
            engine.shutdown()
        }
    }

    @MainActor func testFiveIndexedColdStartsAndPrefetchedSwitchesAndSpectrum() async throws {
        guard #available(macOS 27.0, *) else { throw XCTSkip("HLS audio-tap compatibility path requires macOS 27") }
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let file = try indexedAudio(root)
        let header = try Data(contentsOf: file).prefix(262_144)
        let parsed = try XCTUnwrap(FragmentedAudioIndex.parse(Data(header), total: Int64(try file.resourceValues(forKeys: [.fileSizeKey]).fileSize!)))
        XCTAssertGreaterThan(parsed.segments.count, 10)
        XCTAssertNil(FragmentedAudioIndex.parse(Data(header.prefix(24)), total: 30))
        let server = try RangeFixture(audio: file)
        var times: [Double] = []
        for run in 0..<5 {
            let path = root.appendingPathComponent("indexed\(run)")
            let provider = StreamProvider(server)
            let db = try LibraryDatabase(url: path.appendingPathComponent("db")), cache = try AudioCache(root: path.appendingPathComponent("cache"))
            let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
            defer { engine.shutdown() }; engine.preferences.volume = 0; engine.visualizerVisible = true
            let a = Track(bvid: "indexed-a\(run)", title: "A", duration: 90), b = Track(bvid: "indexed-b\(run)", title: "B", duration: 90)
            engine.setQueue([a,b]); let cold = try await waitForClock(engine); times.append(cold)
            for _ in 0..<800 {
                let key = b.id + ":" + server.url(b.bvid).path
                if await provider.resolved.count == 2, let chunk = try await cache.read(key: key, offset: 0), chunk.data.count == 262_144 { break }
                try await Task.sleep(for: .milliseconds(10))
            }
            let prepared = await provider.resolved.count; XCTAssertEqual(prepared, 2)
            XCTAssertGreaterThan(engine.capturedFrames, 0, "Segmented playback must still capture real PCM")
            if run == 0 {
                // A track-mix tap observes output mute. Briefly use a very quiet test tone.
                engine.preferences.volume = 0.01
                var peak: Float = 0
                for _ in 0..<30 { try await Task.sleep(for: .milliseconds(10)); peak = max(peak, engine.spectrum.max() ?? 0) }
                engine.preferences.volume = 0
                XCTAssertGreaterThan(peak, 0, "The tap must contain actual decoded audio, not only frame callbacks")
            }
            engine.next(); let switched = try await waitForClock(engine); times.append(switched)
            XCTAssertLessThanOrEqual(cold, 2); XCTAssertLessThanOrEqual(switched, 2)
            let resolutions = await provider.resolved.count; XCTAssertEqual(resolutions, 2)
            if run == 0 {
                let lyrics = LyricsParser.parse("[00:00.00]Original lyrics")
                engine.setLyrics(lyrics); engine.setRate(1.25); engine.seek(to: 30)
                try await Task.sleep(for: .milliseconds(400))
                engine.preview(Track(bvid: "preview", title: "Preview", duration: 90))
                _ = try await waitForClock(engine)
                engine.endPreview()
                for _ in 0..<300 { if engine.renderPosition >= 30 && engine.isPlaying { break }; try await Task.sleep(for: .milliseconds(10)) }
                XCTAssertEqual(engine.currentTrack?.id, b.id); XCTAssertEqual(engine.snapshot.rate, 1.25)
                XCTAssertGreaterThanOrEqual(engine.renderPosition, 30); XCTAssertEqual(engine.lyrics.lines.first?.text, "Original lyrics")
                XCTAssertFalse(engine.chapters.isEmpty)
            }
            engine.shutdown()
        }
        print("Controlled indexed cold/prefetched-switch seconds:", times)
    }

    @MainActor func testQueueMutationCancelsObsoletePreparation() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root), rate: 10_000_000, rtt: 0.001)
        let provider = StreamProvider(server, prefetchDelay: .milliseconds(600))
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        defer { engine.shutdown() }; engine.preferences.volume = 0
        let tracks = (0..<3).map { Track(bvid: "mutate\($0)", title: "Song", duration: 90) }
        engine.setQueue(tracks); _ = try await waitForClock(engine)
        for _ in 0..<500 { if await provider.resolved.count >= 2 { break }; try await Task.sleep(for: .milliseconds(10)) }
        engine.removeFromQueue(at: 1)
        let key = tracks[2].id + ":" + server.url(tracks[2].bvid).path
        var prepared = false
        for _ in 0..<500 {
            if let chunk = try await cache.read(key: key, offset: 0), chunk.data.count == 262_144 { prepared = true; break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertTrue(prepared)
        engine.next(); _ = try await waitForClock(engine)
        XCTAssertEqual(engine.currentTrack?.id, tracks[2].id)
        let resolved = await provider.resolved
        XCTAssertEqual(resolved, tracks.map(\.id))
        let stats = try await server.stats()
        XCTAssertFalse(stats.contains { ($0["path"] as? String) == "/\(tracks[1].bvid).m4a" })
    }

    @MainActor func testOptionalPrefetchFailureDoesNotRetryOrChangePlayback() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: audio(root), rate: 10_000_000, rtt: 0.001)
        let provider = StreamProvider(server, rejectPrefetch: true)
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        defer { engine.shutdown() }; engine.preferences.volume = 0
        let a = Track(bvid: "optional-current", title: "Current", duration: 90), b = Track(bvid: "optional-next", title: "Next", duration: 90)
        engine.setQueue([a,b]); _ = try await waitForClock(engine)
        try await Task.sleep(for: .seconds(5))
        let attempts = await provider.resolved
        XCTAssertEqual(attempts, [a.id,b.id]); XCTAssertEqual(engine.currentTrack?.id, a.id)
        XCTAssertTrue(engine.isPlaying); XCTAssertNil(engine.errorMessage)
        XCTAssertFalse(try db.recentTracks().contains { $0.id == b.id })
    }

    func testFragmentServerIsLoopbackNoStoreAndStopsWithLoader() async throws {
        guard #available(macOS 27.0, *) else { throw XCTSkip("Indexed compatibility path requires macOS 27") }
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let server = try RangeFixture(audio: indexedAudio(root), rate: 10_000_000, rtt: 0.001)
        let cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let source = ResolvedAudio(track: Track(bvid: "scope", title: "Fixture"), url: server.url())
        let loader = AudioResourceLoader(source: source, cache: cache)
        defer { loader.cancel() }
        try await loader.prepareForPlayback()
        XCTAssertTrue(loader.isSegmented)
        let url = loader.asset.url
        XCTAssertEqual(url.host, "127.0.0.1")
        let session = URLSession(configuration: .ephemeral); defer { session.invalidateAndCancel() }
        let (playlist, response) = try await session.data(from: url)
        XCTAssertEqual((response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Cache-Control"), "no-store")
        XCTAssertFalse(String(decoding: playlist, as: UTF8.self).contains(source.url.absoluteString))
        let initURL = url.deletingLastPathComponent().appendingPathComponent("init.mp4")
        let (_, initResponse) = try await session.data(from: initURL)
        XCTAssertEqual((initResponse as? HTTPURLResponse)?.value(forHTTPHeaderField: "Cache-Control"), "no-store")
        loader.cancel(); try await Task.sleep(for: .milliseconds(100))
        var request = URLRequest(url: url); request.timeoutInterval = 1
        do { _ = try await session.data(for: request); XCTFail("Cancelled loader left a runnable listener") }
        catch is URLError { }
    }
}
private final class LockedTime: @unchecked Sendable {
    private let lock = NSLock()
    private var time: Double?
    var value: Double? { lock.withLock { time } }
    func record(_ value: Double) { lock.withLock { if time == nil { time = value } } }
}
