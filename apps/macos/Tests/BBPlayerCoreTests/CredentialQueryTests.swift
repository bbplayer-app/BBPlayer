import LocalAuthentication
import Security
import XCTest
@testable import BBPlayerCore

final class CredentialQueryTests: XCTestCase {
    func testStartupQueryProhibitsAuthenticationUI() throws {
        let query = CredentialStore.readQuery(account: "fixture", allowInteraction: false)
        let context = try XCTUnwrap(query[kSecUseAuthenticationContext as String] as? LAContext)
        XCTAssertTrue(context.interactionNotAllowed)
        XCTAssertEqual(query[kSecAttrAccount as String] as? String, "fixture")
        XCTAssertEqual(query[kSecAttrService as String] as? String, "com.bbplayer.macos.credentials")
        XCTAssertNil(CredentialStore.readQuery(account: "fixture", allowInteraction: true)[kSecUseAuthenticationContext as String])
    }
    func testAuthenticationFailuresRequireExplicitUnlock() {
        for code in [errSecInteractionNotAllowed, errSecAuthFailed, errSecUserCanceled] {
            XCTAssertTrue(CredentialStore.requiresUserInteraction(NSError(domain: NSOSStatusErrorDomain, code: Int(code))))
        }
        XCTAssertFalse(CredentialStore.requiresUserInteraction(NSError(domain: NSOSStatusErrorDomain, code: Int(errSecItemNotFound))))
        XCTAssertFalse(CredentialStore.requiresUserInteraction(APIError.network("fixture")))
    }
}
