import XCTest
import GRDB
@testable import BBPlayerCore

final class ScaleTests: XCTestCase {
    func testTenThousandTracksAndOneHundredThousandHistoryEvents() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("scale.sqlite"))
        let tracks = (0..<10_000).map { Track(bvid: "BVscale\($0)", cid: Int64($0), title: "测试歌曲 \($0)", artist: "歌手 \($0 % 20)", duration: 210) }
        let encoder = JSONEncoder(), playlist = Playlist(title: "Large")
        try db.savePlaylist(playlist, tracks: tracks)
        try db.pool.write { database in
            for index in 1..<100 {
                let item = Playlist(title: "Playlist \(index)")
                try database.execute(sql: "INSERT INTO playlist VALUES(?,?,?)", arguments: [item.id, item.title, try encoder.encode(item)])
            }
            for index in 0..<100_000 {
                try database.execute(sql: "INSERT INTO history VALUES(?,?,?,?,?)", arguments: ["session\(index)", tracks[index % tracks.count].id, Date().timeIntervalSince1970 - Double(index * 60), 30, index % 2])
            }
        }
        let begin = ProcessInfo.processInfo.systemUptime
        XCTAssertEqual(try db.tracks(playlistID: playlist.id, limit: 100, offset: 9900).count, 100)
        XCTAssertEqual(try db.playlists().count, 100)
        XCTAssertFalse(try db.search("歌曲 999").isEmpty)
        XCTAssertEqual(try db.summary().completed, 50_000)
        XCTAssertEqual(try db.recentTracks(limit: 100, offset: 100).count, 100)
        let elapsed = ProcessInfo.processInfo.systemUptime - begin
        print("Scale queries: \(elapsed) s; 10k tracks / 100 playlists / 100k history")
        XCTAssertLessThan(elapsed, 3, "Combined scale queries should remain interactive on the current Mac")
    }
}
