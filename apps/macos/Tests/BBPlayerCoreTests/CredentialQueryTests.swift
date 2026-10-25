import Security
import XCTest
@testable import BBPlayerCore

final class CredentialQueryTests: XCTestCase {
    func testLegacyPolicyRestoresStateAfterFailure() throws {
        var before = DarwinBoolean(false)
        XCTAssertEqual(SecKeychainGetUserInteractionAllowed(&before), errSecSuccess)
        XCTAssertThrowsError(try CredentialStore.withInteractionPolicy(allowInteraction: false) {
            var during = DarwinBoolean(true)
            XCTAssertEqual(SecKeychainGetUserInteractionAllowed(&during), errSecSuccess)
            XCTAssertFalse(during.boolValue)
            throw APIError.network("fixture")
        })
        var after = DarwinBoolean(false)
        XCTAssertEqual(SecKeychainGetUserInteractionAllowed(&after), errSecSuccess)
        XCTAssertEqual(after.boolValue, before.boolValue)
    }

    func testLegacyRestrictedItemReturnsWithoutPrompt() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let password = UUID().uuidString
        var keychain: SecKeychain?
        let status = password.withCString { secret in
            SecKeychainCreate(folder.appendingPathComponent("fixture.keychain").path,
                              UInt32(password.utf8.count), secret, false, nil, &keychain)
        }
        XCTAssertEqual(status, errSecSuccess)
        let fixture = try XCTUnwrap(keychain)
        defer { SecKeychainDelete(fixture) }
        var trusted: SecTrustedApplication?
        XCTAssertEqual(SecTrustedApplicationCreateFromPath("/usr/bin/true", &trusted), errSecSuccess)
        var access: SecAccess?
        XCTAssertEqual(SecAccessCreate("Restricted fixture" as CFString,
                                      [try XCTUnwrap(trusted)] as CFArray, &access), errSecSuccess)
        let account = UUID().uuidString
        let item: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.bbplayer.macos.credentials",
            kSecAttrAccount as String: account, kSecValueData as String: Data("fixture".utf8),
            kSecUseKeychain as String: fixture, kSecAttrAccess as String: try XCTUnwrap(access)]
        XCTAssertEqual(SecItemAdd(item as CFDictionary, nil), errSecSuccess)
        var query = CredentialStore.readQuery(account: account)
        query[kSecMatchSearchList as String] = [fixture]
        let result = try CredentialStore.withInteractionPolicy(allowInteraction: false) {
            SecItemCopyMatching(query as CFDictionary, nil)
        }
        XCTAssertTrue([errSecInteractionNotAllowed, errSecAuthFailed].contains(result), "Restricted legacy reads must fail without authentication UI: \(result)")
    }

    func testAuthenticationFailuresRequireExplicitUnlock() {
        for code in [errSecInteractionNotAllowed, errSecAuthFailed, errSecUserCanceled] {
            XCTAssertTrue(CredentialStore.requiresUserInteraction(NSError(domain: NSOSStatusErrorDomain, code: Int(code))))
        }
        XCTAssertFalse(CredentialStore.requiresUserInteraction(NSError(domain: NSOSStatusErrorDomain, code: Int(errSecItemNotFound))))
        XCTAssertFalse(CredentialStore.requiresUserInteraction(APIError.network("fixture")))
    }
}
