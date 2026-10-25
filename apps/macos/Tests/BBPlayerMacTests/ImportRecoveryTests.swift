import Foundation
import XCTest
import BBPlayerCore
@testable import BBPlayerMac

private final class ImportFixtureProtocol: URLProtocol {
    static var mode = "empty"
    static var searches = 0
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let body: String
        if request.url!.path.hasSuffix("/nav") {
            body = #"{"code":0,"data":{"wbi_img":{"img_url":"https://i.example/abcdefghijklmnopqrstuvwxyz012345.png","sub_url":"https://i.example/012345abcdefghijklmnopqrstuvwxyz.png"}}}"#
        } else {
            Self.searches += 1
            switch Self.mode {
            case "limited": body = #"{"code":-352,"message":"Request limited"}"#
            case "malformed": body = #"{"code":0,"data":{"unexpected":true}}"#
            case "success": body = #"{"code":0,"data":{"result":[{"type":"video","bvid":"new","title":"Da Capo HOYO-MIX","duration":"03:00"}]}}"#
            default: body = #"{"code":0,"data":{"result":[]}}"#
            }
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() { }
}

final class ImportRecoveryTests: XCTestCase {
    @MainActor private func makeModel(_ root: URL, mode: String, interval: Duration = .zero) throws -> AppModel {
        ImportFixtureProtocol.mode = mode
        ImportFixtureProtocol.searches = 0
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ImportFixtureProtocol.self]
        let api = BilibiliClient(session: URLSession(configuration: config), importSearchInterval: interval)
        return try AppModel(dataRoot: root, bilibiliClient: api)
    }
    private func job() -> ImportJob {
        var matches = (0..<9).map { ImportMatch(song: ExternalSong(id: "song\($0)", title: "Da Capo", artist: "HOYO-MIX", duration: 180, source: "fixture")) }
        matches[0].candidates = [Track(bvid: "preserved", title: "Confirmed audio")]
        matches[0].selected = 0
        matches[0].reviewed = true
        matches[2].reviewed = true // An explicit skip must survive recovery.
        return ImportJob(title: "Fixture playlist", matches: matches)
    }
    @MainActor private func waitUntilStopped(_ model: AppModel) async {
        for _ in 0..<200 {
            if !model.importRunning { return }
            try? await Task.sleep(for: .milliseconds(10))
        }
        XCTFail("Import did not stop within the fixture deadline")
    }
    @MainActor func testConsecutiveEmptyResultsPauseAndPersistWithoutLosingMatches() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = try makeModel(root, mode: "empty")
        defer { model.shutdown() }
        model.importJob = job()
        model.resumeImport()
        await waitUntilStopped(model)
        let paused = try XCTUnwrap(model.importJob)
        XCTAssertEqual(paused.cursor, 6)
        XCTAssertEqual(ImportFixtureProtocol.searches, 10)
        XCTAssertGreaterThan(try XCTUnwrap(paused.cooldownUntil).timeIntervalSinceNow, 290)
        XCTAssertTrue(paused.hasRetryableFailures)
        XCTAssertEqual(paused.matches[0].track?.bvid, "preserved")
        XCTAssertTrue(paused.matches[2].reviewed)
        XCTAssertNil(paused.matches[7].error)
        let stored = try XCTUnwrap(model.database.state(ImportJob.self, key: "import-job"))
        XCTAssertEqual(stored.cursor, paused.cursor)
        XCTAssertEqual(stored.cooldownUntil, paused.cooldownUntil)
        model.retryFailedImport()
        XCTAssertFalse(model.importRunning)
        XCTAssertEqual(ImportFixtureProtocol.searches, 10)
        model.importJob?.cooldownUntil = Date.distantPast
        ImportFixtureProtocol.mode = "success"
        model.retryFailedImport()
        await waitUntilStopped(model)
        XCTAssertEqual(model.importJob?.cursor, 9)
        XCTAssertEqual(model.importJob?.matches[0].track?.bvid, "preserved")
        XCTAssertNil(model.importJob?.matches[2].track)
        XCTAssertFalse(try XCTUnwrap(model.importJob).hasRetryableFailures)
        XCTAssertNil(model.importJob?.pauseReason)
    }
    @MainActor func testServiceErrorsKeepCursorAndEnforceCooldownAcrossRestart() async throws {
        for mode in ["limited", "malformed"] {
            let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: root) }
            let model = try makeModel(root, mode: mode)
            defer { model.shutdown() }
            model.importJob = job()
            model.resumeImport()
            await waitUntilStopped(model)
            XCTAssertEqual(model.importJob?.cursor, 1)
            XCTAssertEqual(ImportFixtureProtocol.searches, 1)
            XCTAssertNotNil(model.importJob?.matches[1].error)
            XCTAssertGreaterThan(try XCTUnwrap(model.importJob?.cooldownUntil).timeIntervalSinceNow, mode == "limited" ? 290 : 50)
            if mode == "limited" { XCTAssertTrue(model.message?.contains("-352") == true) }
            let restored = try makeModel(root, mode: "success")
            defer { restored.shutdown() }
            restored.resumeImport()
            XCTAssertFalse(restored.importRunning)
            XCTAssertEqual(ImportFixtureProtocol.searches, 0)
            XCTAssertEqual(restored.importJob?.cursor, 1)
        }
    }
    @MainActor func testCancellationDuringFallbackDoesNotAdvanceOrReplaceResult() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = try makeModel(root, mode: "empty", interval: .seconds(10))
        defer { model.shutdown() }
        model.importJob = job()
        model.resumeImport()
        for _ in 0..<100 {
            if ImportFixtureProtocol.searches > 0 { break }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTAssertEqual(ImportFixtureProtocol.searches, 1)
        model.pauseImport()
        await waitUntilStopped(model)
        XCTAssertEqual(model.importJob?.cursor, 1)
        XCTAssertNil(model.importJob?.matches[1].error)
        XCTAssertNil(model.importJob?.cooldownUntil)
        XCTAssertEqual(model.importJob?.matches[0].track?.bvid, "preserved")
    }
}
