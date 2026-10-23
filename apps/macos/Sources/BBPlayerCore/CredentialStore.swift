import Foundation
import Security
import LocalAuthentication

public enum CredentialStore {
    private static let service = "com.bbplayer.macos.credentials"
    static func readQuery(account: String, allowInteraction: Bool) -> [String: Any] {
        var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: account,
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        if !allowInteraction {
            let context = LAContext()
            context.interactionNotAllowed = true
            query[kSecUseAuthenticationContext as String] = context
        }
        return query
    }
    public static func requiresUserInteraction(_ error: Error) -> Bool {
        let error = error as NSError
        return error.domain == NSOSStatusErrorDomain && [Int(errSecInteractionNotAllowed), Int(errSecAuthFailed), Int(errSecUserCanceled)].contains(error.code)
    }
    public static func read(_ account: String = "bilibili-cookie", allowInteraction: Bool = true) throws -> String? {
        let query = readQuery(account: account, allowInteraction: allowInteraction)
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw keychainError(status) }
        return String(data: data, encoding: .utf8)
    }
    public static func write(_ value: String, account: String = "bilibili-cookie") throws {
        guard !value.contains("\n"), !value.contains("\r") else { throw APIError.unavailable("Cookie 不能包含换行符。") }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: account]
        let data = Data(value.utf8)
        let updated = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if updated == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let status = SecItemAdd(item as CFDictionary, nil)
            guard status == errSecSuccess else { throw keychainError(status) }
        } else if updated != errSecSuccess { throw keychainError(updated) }
    }
    public static func delete(_ account: String = "bilibili-cookie") throws {
        let status = SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw keychainError(status) }
    }
    private static func keychainError(_ status: OSStatus) -> NSError {
        NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: [NSLocalizedDescriptionKey: "无法访问系统钥匙串（\(status)）。"])
    }
}
