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
    @MainActor func testManualSelectionPersistsWithoutExclusiveAccessConflictOrDuplicateCandidates() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = try makeModel(root, mode: "empty")
        defer { model.shutdown() }
        var original = job()
        original.cursor = original.matches.count
        original.cooldownUntil = Date().addingTimeInterval(300)
        original.pauseReason = "Paused fixture"
        original.matches[1].error = "No results"
        model.importJob = original
        let selected = Track(bvid: "chosen", title: "Da Capo HOYO-MIX", duration: 180)
        XCTAssertTrue(model.selectImportTrack(selected, at: 1, jobID: original.id))
        XCTAssertEqual(model.importJob?.matches[1].track?.id, selected.id)
        XCTAssertTrue(model.importJob?.matches[1].reviewed == true)
        XCTAssertNil(model.importJob?.matches[1].error)
        // Re-selecting the same video updates its metadata without adding a duplicate.
        var updated = selected
        updated.title = "Da Capo HOYO-MIX refreshed"
        XCTAssertTrue(model.selectImportTrack(updated, at: 1, jobID: original.id))
        XCTAssertEqual(model.importJob?.matches[1].candidates.count, 1)
        XCTAssertEqual(model.importJob?.matches[1].track?.title, updated.title)
        let stored = try XCTUnwrap(model.database.state(ImportJob.self, key: "import-job"))
        XCTAssertEqual(stored.id, original.id)
        XCTAssertEqual(stored.cursor, original.cursor)
        XCTAssertEqual(stored.cooldownUntil, original.cooldownUntil)
        XCTAssertEqual(stored.pauseReason, original.pauseReason)
        XCTAssertEqual(stored.matches[0].track?.bvid, "preserved")
        XCTAssertTrue(stored.matches[2].reviewed)
        XCTAssertNil(stored.matches[2].track)
        XCTAssertEqual(stored.matches[1].track?.title, updated.title)
        XCTAssertTrue(stored.matches[1].reviewed)
        // Replacing an existing candidate selects the appended index safely as well.
        let other = Track(bvid: "other", title: "Another selection")
        XCTAssertTrue(model.selectImportTrack(other, at: 1, jobID: original.id))
        XCTAssertEqual(model.importJob?.matches[1].selected, 1)
        XCTAssertEqual(model.importJob?.matches[1].track?.bvid, "other")
    }
    @MainActor func testStaleOrInvalidManualSelectionDoesNotChangeTheJob() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = try makeModel(root, mode: "empty")
        defer { model.shutdown() }
        model.importJob = job()
        let original = try XCTUnwrap(model.importJob)
        let before = try JSONEncoder().encode(original)
        let track = Track(bvid: "chosen", title: "Selected audio")
        XCTAssertFalse(model.selectImportTrack(track, at: 1, jobID: "obsolete-job"))
        XCTAssertFalse(model.selectImportTrack(track, at: -1, jobID: original.id))
        XCTAssertFalse(model.selectImportTrack(track, at: original.matches.count, jobID: original.id))
        let after = try XCTUnwrap(model.importJob)
        XCTAssertEqual(try JSONSerialization.jsonObject(with: before) as? NSDictionary,
                       try JSONSerialization.jsonObject(with: JSONEncoder().encode(after)) as? NSDictionary)
        XCTAssertNil(try model.database.state(ImportJob.self, key: "import-job"))
    }
    @MainActor func testManualSelectionWriteFailureKeepsUnreviewedResult() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = try makeModel(root, mode: "empty")
        defer { model.shutdown() }
        let original = job()
        model.importJob = original
        try model.database.saveState(original, key: "import-job")
        try model.database.pool.write { db in
            try db.execute(sql: "CREATE TRIGGER reject_import_update BEFORE UPDATE ON state WHEN NEW.key = 'import-job' BEGIN SELECT RAISE(ABORT, 'Fixture write failure'); END")
        }
        XCTAssertFalse(model.selectImportTrack(Track(bvid: "chosen", title: "Audio"), at: 1, jobID: original.id))
        XCTAssertFalse(model.importJob?.matches[1].reviewed == true)
        XCTAssertNil(model.importJob?.matches[1].track)
        XCTAssertNotNil(model.message)
        let stored = try XCTUnwrap(model.database.state(ImportJob.self, key: "import-job"))
        XCTAssertFalse(stored.matches[1].reviewed)
        XCTAssertNil(stored.matches[1].track)
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
