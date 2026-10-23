import XCTest
@testable import BBPlayerCore

private actor WorkflowProvider: MediaSourceProvider {
    func search(_ query: String, page: Int) async throws -> [Track] { [] }
    func resolve(_ track: Track) async throws -> ResolvedAudio { throw APIError.unavailable("Fixture") }
}

final class LibraryWorkflowTests: XCTestCase {
    private var root: URL!
    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: root) }

    func testWholePlaylistAndScopedSearchAcrossPages() throws {
        let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
        let playlist = Playlist(title: "Whole")
        var tracks = (0..<205).map { Track(bvid: "track\($0)", title: "Track \($0)") }
        tracks[184].title = "100%_中文"; tracks[184].artist = "Artist"
        try db.savePlaylist(playlist, tracks: tracks)
        try db.savePlaylist(Playlist(title: "Other"), tracks: [Track(bvid: "unrelated", title: "100%_中文")])
        XCTAssertEqual(try db.playlistTracks(playlistID: playlist.id).map(\.id), tracks.map(\.id))
        XCTAssertEqual(try db.tracks(playlistID: playlist.id).count, 100)
        XCTAssertEqual(try db.tracks(playlistID: playlist.id, offset: 200).count, 5)
        for query in ["100%_", "中文", "Artist", " artist "] {
            XCTAssertEqual(try db.playlistTracks(playlistID: playlist.id, query: query).map(\.id), [tracks[184].id])
        }
        XCTAssertTrue(try db.playlistTracks(playlistID: "missing").isEmpty)
        XCTAssertTrue(try db.playlistTracks(playlistID: playlist.id, query: "missing").isEmpty)
    }
    func testAudioStreamInfoAndLegacyOfflineMetadata() throws {
        let info = AudioStreamInfo(codec: "mp4a.40.2", bitrate: 192000, sampleRate: 44100)
        XCTAssertEqual(info.summary, "AAC · 192 kbps · 44.1 kHz")
        XCTAssertEqual(AudioStreamInfo(codec: "mp4a", bitrate: 0, sampleRate: -1).summary, "AAC")
        let source = ResolvedAudio(track: Track(bvid: "audio", title: "Audio"), url: URL(fileURLWithPath: "/tmp/fixture.m4a"), streamInfo: info)
        let encoded = try JSONEncoder().encode(OfflineAudioMetadata(source: source))
        XCTAssertEqual(try JSONDecoder().decode(OfflineAudioMetadata.self, from: encoded).streamInfo, info)
        var legacy = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        legacy.removeValue(forKey: "streamInfo")
        let restored = try JSONDecoder().decode(OfflineAudioMetadata.self, from: JSONSerialization.data(withJSONObject: legacy))
        XCTAssertNil(restored.streamInfo)
        XCTAssertEqual(restored.track.id, source.track.id)
    }

    func testBatchAppendDeduplicatesAndRetainsOrder() throws {
        let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
        let playlist = Playlist(title: "Batch")
        let tracks = (0..<4).map { Track(bvid: "track", cid: Int64($0), title: "Part \($0)") }
        try db.savePlaylist(playlist, tracks: [tracks[0]])
        try db.append([tracks[0], tracks[2], tracks[2], tracks[1], tracks[3]], to: playlist.id)
        XCTAssertEqual(try db.playlistTracks(playlistID: playlist.id).map(\.id), [tracks[0], tracks[2], tracks[1], tracks[3]].map(\.id))
        XCTAssertThrowsError(try db.append([Track(bvid: "rollback", title: "Rollback")], to: "missing"))
        XCTAssertTrue(try db.search("Rollback").isEmpty, "Failed batch append must roll back track writes")
    }

    func testDateHistoryRetainsRepeatedSessionsAndDayBoundaries() throws {
        let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let date = calendar.date(from: DateComponents(year: 2026, month: 3, day: 8, hour: 12))!
        let interval = calendar.dateInterval(of: .day, for: date)!
        XCTAssertEqual(interval.duration, 23 * 3600, "Day bounds must handle DST")
        let track = Track(bvid: "same", title: "Same song")
        for (id, started) in [("before", interval.start.addingTimeInterval(-1)), ("start", interval.start), ("repeat", date), ("end", interval.end)] {
            try db.checkpointHistory(id: id, track: track, started: started, listened: 12, completed: true)
        }
        let events = try db.listeningEvents(on: date, calendar: calendar)
        XCTAssertEqual(events.map(\.id), ["repeat", "start"])
        XCTAssertEqual(events.map(\.track.id), [track.id, track.id])
        XCTAssertEqual(events.first?.seconds, 12)
        XCTAssertEqual(events.first?.completed, true)
        XCTAssertEqual(try db.listeningEvents(on: date, limit: 1, offset: 1, calendar: calendar).map(\.id), ["start"])
        XCTAssertEqual(try db.recentTracks().count, 1, "Recent songs remain distinct from session history")
    }

    @MainActor func testBatchQueueAndDownloadsPersistWithoutDuplicates() throws {
        let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
        let cache = try AudioCache(root: root.appendingPathComponent("cache"))
        let tracks = (0..<3).map { Track(bvid: "batch", cid: Int64($0), title: "Part \($0)") }
        var saved = PlaybackSnapshot(); saved.queue = [tracks[0]]; saved.position = 42; saved.rate = 1.5
        try db.saveState(saved, key: "playback")
        let engine = NativePlaybackEngine(provider: WorkflowProvider(), database: db, cache: cache)
        defer { engine.shutdown() }
        XCTAssertEqual(engine.enqueue([tracks[0], tracks[1], tracks[1], tracks[2]]), 2)
        XCTAssertEqual(engine.enqueue([]), 0)
        XCTAssertEqual(engine.snapshot.queue.map(\.id), tracks.map(\.id))
        XCTAssertEqual(engine.position, 42)
        XCTAssertEqual(engine.snapshot.rate, 1.5)
        XCTAssertFalse(engine.isPlaybackRequested)
        let manager = try DownloadManager(root: root.appendingPathComponent("downloads"), provider: WorkflowProvider(), database: db)
        manager.add([tracks[0], tracks[1], tracks[1], tracks[2]])
        manager.add(tracks)
        XCTAssertEqual(manager.jobs.map(\.id), tracks.map(\.id))
        manager.pauseAll()
        XCTAssertEqual(try db.state([DownloadJob].self, key: "downloads")?.count, 3)
    }
}
