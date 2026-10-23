import Foundation
import CryptoKit

public enum WBI {
    private static let table = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]
    public static func encode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")) ?? ""
    }
    public static func md5(_ data: Data) -> String {
        // WBI mandates MD5. This digest is not used for credential protection.
        Insecure.MD5.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
    public static func sign(_ params: [String: String], imageKey: String, subKey: String, timestamp: Int = Int(Date().timeIntervalSince1970)) -> [String: String] {
        let source = Array(imageKey + subKey)
        let key = String(table.compactMap { $0 < source.count ? source[$0] : nil }.prefix(32))
        var values = params
        values["wts"] = String(timestamp)
        for (name, value) in values { values[name] = value.filter { !"!'()*".contains($0) } }
        let query = values.keys.sorted().map { "\(encode($0))=\(encode(values[$0]!))" }.joined(separator: "&")
        values["w_rid"] = md5(Data((query + key).utf8))
        return values
    }
    public static func key(from url: String) -> String { URL(string: url)?.deletingPathExtension().lastPathComponent ?? "" }
}

public enum MediaLink {
    public static func bvid(in input: String) -> String? {
        let pattern = "BV[0-9A-Za-z]{10}"
        guard let range = input.range(of: pattern, options: .regularExpression) else { return nil }
        return String(input[range])
    }
    public static func duration(_ input: String) -> Double {
        input.split(separator: ":").reduce(0) { $0 * 60 + (Double($1.trimmingCharacters(in: .whitespaces)) ?? 0) }
    }
    public static func cleanHTML(_ input: String) -> String {
        input.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
    }
}
