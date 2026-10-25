import XCTest
@testable import BBPlayerCore

private final class FixtureProtocol: URLProtocol {
    static var responseBody = Data()
    static var captured: URLRequest?
    static var keywordBodies: [String: Data] = [:]
    static var capturedKeywords: [String] = []
    static var searchTimes: [Date] = []
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.captured = request
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        let keyword = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "keyword" })?.value
        if let keyword { Self.capturedKeywords.append(keyword); Self.searchTimes.append(Date()) }
        client?.urlProtocol(self, didLoad: keyword.flatMap { Self.keywordBodies[$0] } ?? Self.responseBody)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() { }
}
final class RequestTests: XCTestCase {
    func testImportSearchUsesKeywordsWithoutLoginAndSkipsClassroomResults() async throws {
        let api = client(body: #"{"code":0,"data":{"wbi_img":{"img_url":"https://i.example/abcdefghijklmnopqrstuvwxyz012345.png","sub_url":"https://i.example/012345abcdefghijklmnopqrstuvwxyz.png"},"result":[{"type":"video","bvid":"BV1234567890","title":"Da Capo","author":"Artist"},{"type":"ketang","bvid":"BV0987654321","title":"Course"}]}}"#)
        let results = try await api.search("Da Capo HOYO-MiX", authenticated: false)
        XCTAssertEqual(results.map(\.title), ["Da Capo"])
        let request = try XCTUnwrap(FixtureProtocol.captured)
        XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))
        let components = try XCTUnwrap(URLComponents(url: try XCTUnwrap(request.url), resolvingAgainstBaseURL: false))
        XCTAssertEqual(components.path, "/x/web-interface/wbi/search/type")
        XCTAssertEqual(components.queryItems?.first(where: { $0.name == "keyword" })?.value, "Da Capo HOYO-MiX")
        XCTAssertNotNil(components.queryItems?.first(where: { $0.name == "w_rid" }))
    }
    func testWeakImportResultsRetryTitleOnlyAndRejectUnrelatedArtistVideos() async throws {
        let api = client(body: #"{"code":0,"data":{"wbi_img":{"img_url":"https://i.example/abcdefghijklmnopqrstuvwxyz012345.png","sub_url":"https://i.example/012345abcdefghijklmnopqrstuvwxyz.png"},"result":[{"type":"video","bvid":"unrelated","title":"Another song HOYO-MIX"}]}}"#)
        FixtureProtocol.keywordBodies["Da Capo"] = Data(#"{"code":0,"data":{"result":[{"type":"video","bvid":"correct","title":"Da Capo HOYO-MIX"}]}}"#.utf8)
        let song = ExternalSong(id: "fixture", title: "Da Capo", artist: "HOYO-MiX", duration: 0, source: "netease")
        let results = try await api.importCandidates(for: song)
        XCTAssertEqual(results.map(\.bvid), ["correct"])
        XCTAssertEqual(FixtureProtocol.capturedKeywords, ["Da Capo HOYO-MiX", "Da Capo"])
    }
    func testMalformedSearchResponseIsAnErrorRatherThanEmptyResults() async throws {
        let api = client(body: #"{"code":0,"data":{"wbi_img":{"img_url":"https://i.example/abcdefghijklmnopqrstuvwxyz012345.png","sub_url":"https://i.example/012345abcdefghijklmnopqrstuvwxyz.png"}}}"#)
        do { _ = try await api.search("Da Capo"); XCTFail("Expected invalid search response") }
        catch APIError.invalidResponse { }
    }
    func testFallbackSearchRequestsAreSpacedAndExplicitEmptyResponsesAreAccepted() async throws {
        let api = client(body: #"{"code":0,"data":{"wbi_img":{"img_url":"https://i.example/abcdefghijklmnopqrstuvwxyz012345.png","sub_url":"https://i.example/012345abcdefghijklmnopqrstuvwxyz.png"},"numResults":0}}"#, interval: .milliseconds(50))
        let song = ExternalSong(id: "fixture", title: "Da Capo", artist: "HOYO-MIX", duration: 0, source: "fixture")
        let results = try await api.importCandidates(for: song)
        XCTAssertTrue(results.isEmpty)
        XCTAssertEqual(FixtureProtocol.searchTimes.count, 2)
        XCTAssertGreaterThanOrEqual(FixtureProtocol.searchTimes[1].timeIntervalSince(FixtureProtocol.searchTimes[0]), 0.035)
    }
    func testLegacyImportCanRetryFailuresWithoutDuplicatingOrErasingChoices() throws {
        let legacy = #"{"id":"existing-job","title":"Fixture","matches":[{"song":{"id":"1","title":"Song","artist":"Artist","duration":180,"source":"fixture"},"candidates":[],"score":0,"error":"没有匹配结果","reviewed":false}],"cursor":1,"saved":false}"#
        var job = try JSONDecoder().decode(ImportJob.self, from: Data(legacy.utf8))
        XCTAssertNil(job.cooldownUntil)
        XCTAssertTrue(job.retryFailures())
        XCTAssertEqual(job.id, "existing-job")
        XCTAssertEqual(job.matches.count, 1)
        XCTAssertEqual(job.cursor, 0)
        XCTAssertFalse(job.retryFailures())
    }
    func testChapterMetadataAcceptsArrayAndWrappedShapes() {
        let points: [[String: Any]] = [["from": 30, "to": 60, "content": "Chapter 2"], ["from": 0, "to": 30, "content": "Chapter 1"], ["from": -1, "to": 2, "content": "Invalid"]]
        XCTAssertEqual(BilibiliClient.parseChapters(["view_points": points]).map(\.start), [0, 30])
        XCTAssertEqual(BilibiliClient.parseChapters(["view_points": ["points": points]]).map(\.title), ["Chapter 1", "Chapter 2"])
    }
    private func client(body: String, interval: Duration = .zero) -> BilibiliClient {
        FixtureProtocol.searchTimes = []
        FixtureProtocol.keywordBodies = [:]
        FixtureProtocol.capturedKeywords = []
        FixtureProtocol.responseBody = Data(body.utf8)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
        return BilibiliClient(cookie: "SESSDATA=fixture-only", session: URLSession(configuration: config), importSearchInterval: interval)
    }
    func testQRExpiredAndScannedStates() async throws {
        let expired = try await client(body: #"{"code":0,"data":{"code":86038}}"#).pollQR("fixture-key")
        if case .expired = expired { } else { XCTFail("Expected expired") }
        XCTAssertNil(FixtureProtocol.captured?.value(forHTTPHeaderField: "Cookie"))
        let scanned = try await client(body: #"{"code":0,"data":{"code":86090}}"#).pollQR("fixture-key")
        if case .scanned = scanned { } else { XCTFail("Expected scanned") }
    }
    func testExpiredLoginHasTypedErrorAndNoCookieInMessage() async throws {
        do { _ = try await client(body: #"{"code":-101,"message":"not logged in"}"#).profile(); XCTFail("Expected expired login") }
        catch APIError.loginRequired { }
        XCTAssertEqual(FixtureProtocol.captured?.value(forHTTPHeaderField: "Cookie"), "SESSDATA=fixture-only")
        XCTAssertFalse(APIError.loginRequired.localizedDescription.contains("fixture-only"))
    }
    func testLiteralPlusAndChineseAreEncodedWithoutFormAmbiguity() async throws {
        _ = try await client(body: #"{"code":0,"data":{}}"#).request("/fixture", parameters: ["keyword": "C++ 中文"])
        let url = try XCTUnwrap(FixtureProtocol.captured?.url?.absoluteString)
        XCTAssertTrue(url.contains("C%2B%2B%20%E4%B8%AD%E6%96%87"))
    }
    func testCredentialsAreNotSentToArbitraryHosts() async throws {
        do { _ = try await client(body: "{}").request("https://example.com/untrusted"); XCTFail("Expected rejected host") }
        catch APIError.invalidResponse { }
    }
}
