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
    func testDecoratedSongTitlesBeatUnrelatedArtistVideosAndAlternateVersions() {
        let song = ExternalSong(id: "fixture", title: "Da Capo", artist: "HOYO-MiX", duration: 175, source: "netease")
        let correct = Track(bvid: "correct", title: "【崩坏3｜毕业旅行】百万级录音棚听《Da Capo》动画短片印象曲HOYO-MIX【Hi-Res】", duration: 175)
        let unrelated = Track(bvid: "unrelated", title: "星与舫的幽歌 Skein-Song of Stars and Sails HOYO-MIX", duration: 175)
        let version = Track(bvid: "version", title: "Da Capo HOYO-MiX 动态鼓谱", duration: 175)
        let sameName = Track(bvid: "same-name", title: "Beautiful World (Da Capo Version) 宇多田光", duration: 175)
        XCTAssertGreaterThan(Matching.score(song, correct), 0.85)
        XCTAssertEqual(Matching.score(song, unrelated), 0)
        XCTAssertLessThan(Matching.score(song, version), 0.72)
        XCTAssertLessThan(Matching.score(song, sameName), 0.72)
        XCTAssertEqual(Matching.rankedCandidates(song, [unrelated, version, correct, correct]).map(\.bvid), ["correct", "version"])
    }
    func testSharedScatteredCharactersAndPartialEnglishWordsDoNotMatchSongNames() {
        XCTAssertLessThan(Matching.titleRelevance("青い春と西の空", "青春故事与西方天空中的音乐合集"), 0.8)
        XCTAssertLessThan(Matching.titleRelevance("One", "Someone shows a stone"), 0.8)
        XCTAssertEqual(Matching.titleRelevance("青い春と西の空", "【Hi-Res】青い春と西の空（蔚蓝春日与西暮余霞）"), 1)
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
