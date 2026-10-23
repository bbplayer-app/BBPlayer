import XCTest
@testable import BBPlayerCore

final class CoreTests: XCTestCase {
    private var root: URL!
    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("bbplayer-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: root) }
    func testStableTrackIdentityDoesNotDependOnTitleOrURL() {
        let first = Track(bvid: "BV1Zu411x7mc", cid: 123, title: "Old")
        let second = Track(bvid: "BV1Zu411x7mc", cid: 123, title: "New")
        XCTAssertEqual(first.id, second.id)
        XCTAssertNotEqual(first.id, Track(bvid: first.bvid, cid: 124, title: first.title).id)
    }
    func testWBIMD5AndSanitization() {
        XCTAssertEqual(WBI.md5(Data("abc".utf8)), "900150983cd24fb0d6963f7d28e17f72")
        let signed = WBI.sign(["keyword": "测试!a'(b)*"], imageKey: String(repeating: "a", count: 32), subKey: String(repeating: "b", count: 32), timestamp: 123)
        XCTAssertEqual(signed["keyword"], "测试ab")
        XCTAssertEqual(signed["wts"], "123")
        XCTAssertEqual(signed["w_rid"]?.count, 32)
        XCTAssertEqual(WBI.encode("测试 空格"), "%E6%B5%8B%E8%AF%95%20%E7%A9%BA%E6%A0%BC")
    }
    func testLyricsWordsTranslationAndBinarySearch() {
        let document = LyricsParser.parse("[00:01.00]Hello[00:02.00]World[00:03.00]\n[00:04.00]Next", translation: "[00:01.00]你好世界")
        XCTAssertEqual(document.lines.count, 2)
        XCTAssertEqual(document.lines[0].words.map(\.text), ["Hello", "World"])
        XCTAssertEqual(document.lines[0].words[1].end, 3)
        XCTAssertEqual(document.lines[0].translation, "你好世界")
        XCTAssertNil(document.index(at: 0.5))
        XCTAssertEqual(document.index(at: 3.5), 0)
        XCTAssertEqual(document.index(at: 4), 1)
    }
    func testRepeatedLRCTimestampsAndOffset() {
        let document = LyricsParser.parse("[offset:500]\n[00:01.00][00:05.00]Repeat")
        XCTAssertEqual(document.lines.map(\.start), [1, 5])
        XCTAssertEqual(document.lines.map(\.text), ["Repeat", "Repeat"])
        XCTAssertEqual(document.index(at: 0.5), 0)
    }
    func testYRCMillisecondsConvertToSeconds() {
        let document = LyricsParser.parseYRC("[1000,900](1000,400,0)你(1400,500,0)好")
        XCTAssertEqual(document.lines[0].text, "你好")
        XCTAssertEqual(document.lines[0].words[1].start, 1.4)
        XCTAssertEqual(document.lines[0].end, 1.9)
    }
    func testActualListeningUsesWallClockNotMediaDuration() {
        var accumulator = ListeningAccumulator()
        XCTAssertEqual(accumulator.update(clock: 10, audible: true), 0)
        XCTAssertEqual(accumulator.update(clock: 10.25, audible: true), 0.25)
        XCTAssertEqual(accumulator.update(clock: 20, audible: false), 0)
        XCTAssertEqual(accumulator.update(clock: 21, audible: true), 0)
        XCTAssertEqual(accumulator.update(clock: 21.25, audible: true), 0.25)
        XCTAssertEqual(accumulator.audibleSeconds, 0.5)
    }
    func testLoudnessMissingAndNoAmplification() {
        XCTAssertEqual(Loudness.gain(measured: nil), 1)
        XCTAssertEqual(Loudness.gain(measured: .nan), 1)
        XCTAssertEqual(Loudness.gain(measured: -24), 1)
        XCTAssertEqual(Loudness.gain(measured: -8), 0.5011872, accuracy: 0.0001)
    }
    func testPlaylistTransactionAndHistoryIdempotency() throws {
        let database = try LibraryDatabase(url: root.appendingPathComponent("test.sqlite"))
        let track = Track(bvid: "BV1Zu411x7mc", cid: 123, title: "歌曲")
        let playlist = Playlist(title: "我的歌单")
        try database.savePlaylist(playlist, tracks: [track, track])
        XCTAssertEqual(try database.tracks(playlistID: playlist.id).count, 1)
        XCTAssertEqual(try database.playlists().first?.count, 1)
        let started = Date()
        try database.checkpointHistory(id: "session", track: track, started: started, listened: 12, completed: false)
        try database.checkpointHistory(id: "session", track: track, started: started, listened: 8, completed: true)
        let summary = try database.summary()
        XCTAssertEqual(summary.seconds, 12)
        XCTAssertEqual(summary.completed, 1)
        try database.deletePlaylist(playlist.id)
        XCTAssertEqual(try database.playlists().count, 0)
        XCTAssertEqual(try database.summary().seconds, 12)
    }
    func testSearchEscapesWildcardAndSupportsChinese() throws {
        let database = try LibraryDatabase(url: root.appendingPathComponent("search.sqlite"))
        let tracks = [Track(bvid: "A", title: "中文歌曲"), Track(bvid: "B", title: "100% Love"), Track(bvid: "C", title: "Another")]
        try database.savePlaylist(Playlist(title: "Test"), tracks: tracks)
        XCTAssertEqual(try database.search("歌曲").count, 1)
        XCTAssertEqual(try database.search("%").map(\.bvid), ["B"])
    }
    func testRangeValidationRejectsWrongOffsetAndHTTPError() throws {
        XCTAssertEqual(try HTTPRange.validate(status: 206, contentRange: "bytes 100-199/500", contentLength: 100, offset: 100), 500)
        XCTAssertThrowsError(try HTTPRange.validate(status: 200, contentRange: nil, contentLength: 500, offset: 100))
        XCTAssertThrowsError(try HTTPRange.validate(status: 206, contentRange: "bytes 0-99/500", contentLength: 100, offset: 100))
        XCTAssertThrowsError(try HTTPRange.validate(status: 403, contentRange: nil, contentLength: 200, offset: 0))
    }
    func testPinnedCacheReferenceCountsAndSeparateUserFiles() async throws {
        let cache = try AudioCache(root: root.appendingPathComponent("stream"), limit: 100_000)
        let download = root.appendingPathComponent("download.m4a")
        try Data([1,2,3]).write(to: download)
        await cache.pin("track")
        await cache.pin("track")
        try await cache.store(AudioChunk(data: Data(repeating: 7, count: 1024), offset: 0, total: 1024), key: "track")
        await cache.unpin("track")
        try await cache.clear()
        let retained = try await cache.read(key: "track", offset: 0)
        XCTAssertEqual(retained?.data.count, 1024)
        await cache.unpin("track")
        try await cache.clear()
        let cleared = try await cache.read(key: "track", offset: 0)
        XCTAssertNil(cleared)
        XCTAssertEqual(try Data(contentsOf: download), Data([1,2,3]))
    }
}
