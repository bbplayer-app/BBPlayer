import GRDB
import XCTest
@testable import BBPlayerCore

final class PlaylistUndoTests: XCTestCase {
    private var root: URL!
    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: root) }

    func testRestoreAfterReopenPreservesAllPagesOrderAndSharedData() throws {
        let url = root.appendingPathComponent("library.sqlite")
        let database = try LibraryDatabase(url: url)
        let tracks = (0..<205).map { Track(bvid: "part", cid: Int64($0), title: "Track \($0)") }
        let playlist = Playlist(title: "Large playlist", coverURL: URL(string: "https://example.com/cover.png"))
        try database.savePlaylist(playlist, tracks: tracks)
        try database.checkpointHistory(id: "history", track: tracks[0], started: Date(), listened: 12, completed: false)
        try database.saveLyrics(LyricsParser.parse("[00:00.00]Keep lyrics"), trackID: tracks[0].id)
        try database.saveState("keep-download", key: "download-file:" + tracks[0].id)
        try database.deletePlaylist(playlist.id)
        XCTAssertTrue(try database.playlists().isEmpty)
        XCTAssertEqual(try database.deletedPlaylist()?.count, 205)
        var updated = tracks[0]; updated.title = "Updated shared metadata"
        let other = Playlist(title: "Other")
        try database.savePlaylist(other, tracks: [updated])
        let reopened = try LibraryDatabase(url: url)
        XCTAssertEqual(try reopened.deletedPlaylist()?.id, playlist.id)
        XCTAssertEqual(try reopened.restoreDeletedPlaylist()?.coverURL, playlist.coverURL)
        XCTAssertEqual(try reopened.tracks(playlistID: playlist.id, limit: 1000).map(\.id), tracks.map(\.id))
        XCTAssertEqual(try reopened.tracks(playlistID: playlist.id).first?.title, updated.title)
        XCTAssertEqual(try reopened.tracks(playlistID: other.id), [updated])
        XCTAssertEqual(try reopened.summary().seconds, 12)
        XCTAssertEqual(try reopened.lyrics(trackID: tracks[0].id)?.lines.first?.text, "Keep lyrics")
        XCTAssertEqual(try reopened.state(String.self, key: "download-file:" + tracks[0].id), "keep-download")
        XCTAssertNil(try reopened.deletedPlaylist())
        XCTAssertNil(try reopened.restoreDeletedPlaylist())
    }

    func testLatestDeletionEmptyPlaylistAndConflictProtection() throws {
        let database = try LibraryDatabase(url: root.appendingPathComponent("library.sqlite"))
        let first = Playlist(title: "First"), last = Playlist(title: "Empty")
        try database.savePlaylist(first, tracks: [])
        try database.savePlaylist(last, tracks: [])
        try database.deletePlaylist(first.id)
        try database.deletePlaylist(last.id)
        try database.deletePlaylist("missing")
        XCTAssertEqual(try database.deletedPlaylist()?.id, last.id)
        var conflicting = last; conflicting.title = "Existing content"
        try database.savePlaylist(conflicting, tracks: [Track(bvid: "existing", title: "Existing")])
        XCTAssertThrowsError(try database.restoreDeletedPlaylist())
        XCTAssertEqual(try database.deletedPlaylist()?.id, last.id)
        XCTAssertEqual(try database.playlists().first?.title, conflicting.title)
        XCTAssertEqual(try database.tracks(playlistID: last.id).count, 1)
    }

    func testFailedDeletionAndRestoreRollBackAndKeepRecoveryRecord() throws {
        let database = try LibraryDatabase(url: root.appendingPathComponent("library.sqlite"))
        let first = Playlist(title: "First"), second = Playlist(title: "Second")
        let track = Track(bvid: "fixture", title: "Fixture")
        try database.savePlaylist(first, tracks: [track])
        try database.savePlaylist(second, tracks: [track])
        try database.deletePlaylist(first.id)
        try database.pool.write { db in
            try db.execute(sql: "CREATE TRIGGER fail_delete BEFORE DELETE ON playlist BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        }
        XCTAssertThrowsError(try database.deletePlaylist(second.id))
        XCTAssertEqual(try database.deletedPlaylist()?.id, first.id)
        XCTAssertEqual(try database.tracks(playlistID: second.id), [track])
        try database.pool.write { db in
            try db.execute(sql: "DROP TRIGGER fail_delete")
            try db.execute(sql: "CREATE TRIGGER fail_restore BEFORE INSERT ON playlist_track BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        }
        XCTAssertThrowsError(try database.restoreDeletedPlaylist())
        XCTAssertEqual(try database.playlists().map(\.id), [second.id])
        XCTAssertEqual(try database.deletedPlaylist()?.id, first.id)
        try database.pool.write { try $0.execute(sql: "DROP TRIGGER fail_restore") }
        XCTAssertEqual(try database.restoreDeletedPlaylist()?.id, first.id)
        XCTAssertEqual(try database.tracks(playlistID: first.id), [track])
    }
}
