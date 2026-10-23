import XCTest
@testable import BBPlayerCore

final class ParityTests: XCTestCase {
    // Cases ported from packages/splash/src/parser/index.test.ts.
    func testSPLExplicitAndImplicitTranslationsGroupByTime() {
        let doc = LyricsParser.parse("[00:01.00][00:03.00]Main\nImplicit Trans\n[00:01.00]Trans 2\n[00:02.00]Next")
        XCTAssertEqual(doc.lines.map(\.start), [1, 2, 3])
        XCTAssertEqual(doc.lines[0].translation, "Implicit Trans\nTrans 2")
        XCTAssertEqual(doc.lines[2].translation, "Implicit Trans")
        XCTAssertEqual(doc.lines.last?.end, 13)
    }
    func testSPLExplicitEndAndNegativeTime() {
        let doc = LyricsParser.parse("[-1:-1.000]Negative\n[00:01.00]Text[00:02.00]\n[00:04.00]Last")
        XCTAssertEqual(doc.lines[0].start, 0)
        XCTAssertEqual(doc.lines[1].end, 2)
        XCTAssertEqual(doc.lines[1].words.first?.end, 2)
        XCTAssertEqual(doc.lines[2].end, 14)
    }
    func testMatchingRejectsWrongDurationAndVersion() {
        let song = ExternalSong(id: "1", title: "Blue spring", artist: "Band", duration: 210, source: "netease")
        let correct = Track(bvid: "1", title: "Blue spring", artist: "Band", duration: 210)
        let wrong = Track(bvid: "2", title: "Blue spring remix", artist: "Other", duration: 400)
        XCTAssertGreaterThan(Matching.score(song, correct), 0.85)
        XCTAssertLessThan(Matching.score(song, wrong), 0.6)
    }
    func testDeletedStateDoesNotLeaveNullDecodingFailure() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let db = try LibraryDatabase(url: root.appendingPathComponent("db"))
        try db.saveState(URL(fileURLWithPath: "/tmp/audio"), key: "file")
        try db.removeState(key: "file")
        XCTAssertNil(try db.state(URL.self, key: "file"))
    }
}
