import XCTest
@testable import BBPlayerCore

final class DanmakuTests: XCTestCase {
    private func number(_ n: UInt64) -> [UInt8] {
        var value = n, result: [UInt8] = []
        repeat { let byte = UInt8(value & 127); value >>= 7; result.append(byte | (value > 0 ? 128 : 0)) } while value > 0
        return result
    }
    private func entry(time: UInt64, mode: UInt8 = 1, text: String) -> [UInt8] {
        let body = [16] + number(time) + [24, mode, 40] + number(0x12abcd) + [58] + number(UInt64(text.utf8.count)) + Array(text.utf8)
        return [10] + number(UInt64(body.count)) + body
    }
    func testTimestampsColorsAndUnknownFields() throws {
        let bytes = entry(time: 4000, text: "弹幕🎵") + [152, 6, 1] + entry(time: 1000, text: "first")
        let result = try DanmakuParser.parse(Data(bytes))
        XCTAssertEqual(result.map(\.time), [1, 4]); XCTAssertEqual(result.last?.text, "弹幕🎵"); XCTAssertEqual(result.last?.color, 0x12abcd)
    }
    func testUnsupportedModesAndInvalidProtobuf() throws {
        XCTAssertTrue(try DanmakuParser.parse(Data(entry(time: 0, mode: 7, text: "advanced"))).isEmpty)
        for bytes: [UInt8] in [[10, 100, 1], [0], [10, 1, 16], Array(repeating: 255, count: 11)] { XCTAssertThrowsError(try DanmakuParser.parse(Data(bytes))) }
        XCTAssertEqual(try DanmakuParser.parse(Data()), [])
    }
    func testLaneSpacingAndDeterministicSeek() {
        let comments = [DanmakuComment(time: 0, text: "long"), DanmakuComment(time: 0.5, text: "blocked"), DanmakuComment(time: 2, text: "later")]
        let flights = DanmakuLayout.schedule(comments, widths: [100, 20, 20], viewport: 500, lanes: 1, density: 3)
        XCTAssertEqual(flights.map(\.comment.text), ["long", "later"])
        XCTAssertEqual(flights[0].end, 6)
        XCTAssertEqual(flights.filter { $0.comment.time <= 3 && $0.end > 3 }.count, 2)
        XCTAssertTrue(DanmakuLayout.schedule(comments, widths: [], viewport: 500, lanes: 1, density: 1).isEmpty)
    }
    func testDensityIsBounded() {
        let comments = (0..<50).map { DanmakuComment(time: Double($0) / 100, text: "test") }
        XCTAssertEqual(DanmakuLayout.schedule(comments, widths: Array(repeating: 30, count: 50), viewport: 500, lanes: 20, density: 3).count, 3)
    }
}
