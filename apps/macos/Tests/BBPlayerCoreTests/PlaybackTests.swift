import AVFoundation
import XCTest
@testable import BBPlayerCore

private actor FailingProvider: MediaSourceProvider {
    private(set) var attempts = 0
    func search(_ query: String, page: Int) async throws -> [Track] { [] }
    func resolve(_ track: Track) async throws -> ResolvedAudio { attempts += 1; throw APIError.unavailable("Deleted test track") }
}
private actor LocalProvider: MediaSourceProvider {
    let url: URL
    let delay: Duration
    private(set) var attempts = 0
    init(url: URL, delay: Duration = .zero) { self.url = url; self.delay = delay }
    func search(_ query: String, page: Int) async throws -> [Track] { [] }
    func resolve(_ track: Track) async throws -> ResolvedAudio { attempts += 1; try await Task.sleep(for: delay); return ResolvedAudio(track: track, url: url) }
}
final class PlaybackTests: XCTestCase {
    @MainActor func testQueueDragMovesBlocksAndPreservesActiveOccurrence() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let a = Track(bvid: "a", title: "A"), b = Track(bvid: "b", title: "B"), c = Track(bvid: "c", title: "C")
        let cases: [(IndexSet, Int, [Track], Int)] = [
            (IndexSet([0, 2]), 4, [b, a, a, c], 1),
            (IndexSet([2, 3]), 0, [c, a, a, b], 1),
            (IndexSet(integer: 3), 1, [a, a, b, c], 1),
            (IndexSet(integer: 0), 4, [b, c, a, a], 2),
            (IndexSet([1, 3]), 4, [a, c, b, a], 3),
            (IndexSet(integer: 3), 4, [a, b, c, a], 3)
        ]
        for (offsets, destination, expected, activeIndex) in cases {
            var saved = PlaybackSnapshot(); saved.queue = [a, b, c, a]; saved.index = 3; saved.position = 42; saved.rate = 1.5
            try db.saveState(saved, key: "playback")
            let engine = NativePlaybackEngine(provider: FailingProvider(), database: db, cache: cache)
            engine.moveQueue(fromOffsets: offsets, toOffset: destination)
            XCTAssertEqual(engine.snapshot.queue.map(\.id), expected.map(\.id))
            XCTAssertEqual(engine.snapshot.index, activeIndex, "The active duplicate must not jump to the first matching ID")
            XCTAssertEqual(engine.position, 42)
            XCTAssertEqual(engine.snapshot.rate, 1.5)
            XCTAssertFalse(engine.isPlaybackRequested)
            let persisted = try XCTUnwrap(db.state(PlaybackSnapshot.self, key: "playback"))
            XCTAssertEqual(persisted.queue.map(\.id), expected.map(\.id))
            XCTAssertEqual(persisted.index, activeIndex)
            engine.shutdown()
        }
    }

    @MainActor func testQueueArrowMovesAndInvalidDragDoNotChangePlayback() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let tracks = (0..<4).map { Track(bvid: "move\($0)", title: "Track \($0)") }
        var saved = PlaybackSnapshot(); saved.queue = tracks; saved.index = 2; saved.position = 42
        try db.saveState(saved, key: "playback")
        let engine = NativePlaybackEngine(provider: FailingProvider(), database: db, cache: cache)
        defer { engine.shutdown() }
        engine.moveQueue(from: 2, to: 0)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [tracks[2], tracks[0], tracks[1], tracks[3]].map(\.id))
        XCTAssertEqual(engine.snapshot.index, 0)
        engine.moveQueue(from: 0, to: 3)
        let expected = [tracks[0], tracks[1], tracks[3], tracks[2]]
        XCTAssertEqual(engine.snapshot.queue.map(\.id), expected.map(\.id))
        XCTAssertEqual(engine.snapshot.index, 3)
        for (offsets, destination) in [(IndexSet(), 0), (IndexSet(integer: 9), 0), (IndexSet(integer: 0), -1), (IndexSet(integer: 0), 9)] {
            engine.moveQueue(fromOffsets: offsets, toOffset: destination)
        }
        XCTAssertEqual(engine.snapshot.queue.map(\.id), expected.map(\.id))
        XCTAssertEqual(engine.snapshot.index, 3)
        XCTAssertEqual(engine.position, 42)
        XCTAssertFalse(engine.isPlaybackRequested)
    }

    @MainActor func testEnqueueDeduplicatesByContentIdentityAndPersists() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let current = Track(bvid: "queue", cid: 1, title: "Current", duration: 300)
        let otherPart = Track(bvid: "queue", cid: 2, title: "Other part", duration: 300)
        var saved = PlaybackSnapshot(); saved.queue = [current]; saved.position = 42
        try db.saveState(saved, key: "playback")
        let engine = NativePlaybackEngine(provider: FailingProvider(), database: db, cache: cache)
        defer { engine.shutdown() }
        engine.enqueue(current)
        engine.enqueue(otherPart)
        engine.enqueue(otherPart)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [current.id, otherPart.id])
        XCTAssertEqual(engine.position, 42)
        XCTAssertFalse(engine.isPlaybackRequested)
        let persisted = try XCTUnwrap(db.state(PlaybackSnapshot.self, key: "playback"))
        XCTAssertEqual(persisted.queue.map(\.id), [current.id, otherPart.id])
        XCTAssertEqual(persisted.position, 42)
    }

    @MainActor func testPlayNextMovesAllMatchingEntriesWithoutChangingCurrent() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let target = Track(bvid: "target", title: "Target"), current = Track(bvid: "current", title: "Current", duration: 300)
        let tail = Track(bvid: "tail", title: "Tail"), fresh = Track(bvid: "fresh", title: "Fresh")
        var saved = PlaybackSnapshot(); saved.queue = [target, current, tail, target]; saved.index = 1; saved.position = 42; saved.rate = 1.5
        try db.saveState(saved, key: "playback")
        let engine = NativePlaybackEngine(provider: FailingProvider(), database: db, cache: cache)
        defer { engine.shutdown() }
        engine.enqueue(target, next: true)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [current.id, target.id, tail.id])
        XCTAssertEqual(engine.snapshot.index, 0)
        engine.enqueue(target, next: true)
        engine.enqueue(current, next: true)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [current.id, target.id, tail.id])
        engine.enqueue(fresh, next: true)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [current.id, fresh.id, target.id, tail.id])
        XCTAssertEqual(engine.currentTrack?.id, current.id)
        XCTAssertEqual(engine.position, 42)
        XCTAssertEqual(engine.snapshot.rate, 1.5)
        XCTAssertFalse(engine.isPlaybackRequested)
    }

    @MainActor func testThreePermanentFailuresStopAndPreserveQueue() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let provider = FailingProvider()
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        engine.setQueue((0..<5).map { Track(bvid: "failure\($0)", title: "Test") })
        for _ in 0..<20 { try await Task.sleep(for: .milliseconds(50)); if await provider.attempts >= 3 { break } }
        let attempts = await provider.attempts
        XCTAssertEqual(attempts, 3)
        XCTAssertEqual(engine.snapshot.queue.count, 5)
        XCTAssertEqual(engine.snapshot.index, 2)
        XCTAssertFalse(engine.isPlaying)
        engine.shutdown()
    }
    @MainActor func testRestorePausedQueueDoesNotClobberSavedPosition() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        var snapshot = PlaybackSnapshot(); snapshot.queue = [Track(bvid: "restore", title: "Long", duration: 900)]; snapshot.position = 123; snapshot.rate = 1.5
        try db.saveState(snapshot, key: "playback")
        let engine = NativePlaybackEngine(provider: FailingProvider(), database: db, cache: cache)
        try await Task.sleep(for: .milliseconds(600))
        XCTAssertEqual(engine.position, 123)
        XCTAssertEqual(engine.snapshot.rate, 1.5)
        XCTAssertFalse(engine.isPlaying)
        engine.shutdown()
        XCTAssertTrue(try db.recentTracks().isEmpty, "Restoring without playback must not create listening history")
    }
    @MainActor func testPauseDuringResolutionPreventsLateAutoplay() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appendingPathComponent("silence.caf"), format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 96_000)!; buffer.frameLength = buffer.frameCapacity
        let file = try AVAudioFile(forWriting: url, settings: format.settings); try file.write(from: buffer)
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: LocalProvider(url: url, delay: .milliseconds(300)), database: db, cache: cache, restore: false)
        engine.preferences.volume = 0
        engine.setQueue([Track(bvid: "delayed", title: "Fixture", duration: 2)])
        engine.toggle()
        try await Task.sleep(for: .milliseconds(900))
        XCTAssertFalse(engine.isPlaying)
        XCTAssertEqual(engine.position, 0, accuracy: 0.01)
        engine.play()
        for _ in 0..<30 { try await Task.sleep(for: .milliseconds(100)); if engine.position > 0.1 { break } }
        XCTAssertGreaterThan(engine.position, 0.1)
        engine.shutdown()
    }
    @MainActor func testRepeatReusesLoadedAudioAndCanRestartAfterEnd() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appendingPathComponent("repeat.caf"), format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 96_000)!; buffer.frameLength = buffer.frameCapacity
        buffer.floatChannelData![0].initialize(repeating: 0, count: Int(buffer.frameLength))
        let file = try AVAudioFile(forWriting: url, settings: format.settings); try file.write(from: buffer)
        let provider = LocalProvider(url: url)
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        engine.preferences.volume = 0; engine.setRepeat(.track)
        engine.setQueue([Track(bvid: "repeat", title: "Fixture", duration: 2)])
        try await Task.sleep(for: .milliseconds(4500))
        let attempts = await provider.attempts
        XCTAssertEqual(attempts, 1, "Single-track repeat must not resolve the network URL again")
        XCTAssertTrue(engine.isPlaybackRequested)
        XCTAssertTrue(engine.isPlaying)
        engine.setRepeat(.off)
        for _ in 0..<30 { try await Task.sleep(for: .milliseconds(100)); if !engine.isPlaybackRequested { break } }
        XCTAssertFalse(engine.isPlaybackRequested)
        engine.play()
        for _ in 0..<25 { try await Task.sleep(for: .milliseconds(100)); if engine.isPlaying && engine.position < 1.5 { break } }
        XCTAssertTrue(engine.isPlaying)
        XCTAssertLessThan(engine.position, 1.5)
        engine.shutdown()
    }
    @MainActor func testRealPCMSpectrumAndPreviewContextRestoration() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appendingPathComponent("sine.caf"), format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1_440_000)!; buffer.frameLength = buffer.frameCapacity
        for i in 0..<Int(buffer.frameLength) { buffer.floatChannelData![0][i] = sin(Float(i) * 2 * .pi * 440 / 48_000) * 0.3 }
        let file = try AVAudioFile(forWriting: url, settings: format.settings); try file.write(from: buffer)
        let db = try LibraryDatabase(url: root.appendingPathComponent("db")), cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let provider = LocalProvider(url: url)
        let engine = NativePlaybackEngine(provider: provider, database: db, cache: cache, restore: false)
        engine.preferences.volume = 0; engine.visualizerVisible = true
        engine.setQueue([Track(bvid: "original", title: "Original", duration: 30)])
        var peak: Float = 0
        for _ in 0..<35 { try await Task.sleep(for: .milliseconds(100)); peak = max(peak, engine.spectrum.max() ?? 0); if peak > 0.1 { break } }
        XCTAssertGreaterThan(engine.capturedFrames, 0)
        XCTAssertGreaterThan(peak, 0.1)
        engine.visualizerVisible = false
        let before = engine.position
        for _ in 0..<30 { try await Task.sleep(for: .milliseconds(100)); if engine.position > before + 0.2 { break } }
        XCTAssertTrue(engine.isPlaying)
        XCTAssertGreaterThan(engine.position, before)
        engine.visualizerVisible = true
        for _ in 0..<30 { try await Task.sleep(for: .milliseconds(100)); if engine.spectrum.max() ?? 0 > 0.1 { break } }
        XCTAssertGreaterThan(engine.spectrum.max() ?? 0, 0.1)
        let activeTrack = try XCTUnwrap(engine.currentTrack)
        let queuedTrack = Track(bvid: "queued", title: "Queued", duration: 30)
        let playingPosition = engine.position
        engine.enqueue(queuedTrack)
        engine.enqueue(queuedTrack)
        engine.enqueue(queuedTrack, next: true)
        engine.enqueue(activeTrack, next: true)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [activeTrack.id, queuedTrack.id])
        engine.moveQueue(fromOffsets: IndexSet(integer: 0), toOffset: 2)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), [queuedTrack.id, activeTrack.id])
        XCTAssertEqual(engine.snapshot.index, 1)
        engine.moveQueue(from: 1, to: 0)
        XCTAssertEqual(engine.currentTrack?.id, activeTrack.id)
        XCTAssertEqual(engine.position, playingPosition)
        XCTAssertTrue(engine.isPlaying)
        let resolutions = await provider.attempts
        XCTAssertEqual(resolutions, 1, "Queue edits must not resolve or reload the playing track")
        engine.pause(); let position = engine.position
        engine.setLyrics(LyricsParser.parse("[00:00.00]Original lyric"))
        engine.preview(Track(bvid: "preview", title: "Preview", duration: 10))
        try await Task.sleep(for: .milliseconds(300))
        engine.endPreview()
        XCTAssertEqual(engine.currentTrack?.bvid, "original")
        XCTAssertEqual(engine.position, position, accuracy: 0.3)
        XCTAssertEqual(engine.lyrics.lines.first?.text, "Original lyric")
        XCTAssertFalse(engine.isPlaying)
        engine.shutdown()
    }
}
