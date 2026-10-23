import XCTest
@testable import BBPlayerCore

private final class FixtureProtocol: URLProtocol {
    static var responseBody = Data()
    static var captured: URLRequest?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.captured = request
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseBody)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() { }
}
final class RequestTests: XCTestCase {
    func testChapterMetadataAcceptsArrayAndWrappedShapes() {
        let points: [[String: Any]] = [["from": 30, "to": 60, "content": "Chapter 2"], ["from": 0, "to": 30, "content": "Chapter 1"], ["from": -1, "to": 2, "content": "Invalid"]]
        XCTAssertEqual(BilibiliClient.parseChapters(["view_points": points]).map(\.start), [0, 30])
        XCTAssertEqual(BilibiliClient.parseChapters(["view_points": ["points": points]]).map(\.title), ["Chapter 1", "Chapter 2"])
    }
    private func client(body: String) -> BilibiliClient {
        FixtureProtocol.responseBody = Data(body.utf8)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
        return BilibiliClient(cookie: "SESSDATA=fixture-only", session: URLSession(configuration: config))
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
