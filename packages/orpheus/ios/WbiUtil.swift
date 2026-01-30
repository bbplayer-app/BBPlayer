import Foundation
import CommonCrypto

class WbiUtil {
    private static let mixinKeyEncTab: [Int] = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ]

    static func getMixinKey(orig: String) -> String {
        var result = ""
        let origChars = Array(orig)
        for i in 0..<32 {
            if i < mixinKeyEncTab.count {
                let index = mixinKeyEncTab[i]
                if index < origChars.count {
                    result.append(origChars[index])
                }
            }
        }
        return result
    }

    static func encodeURIComponent(_ string: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-_.~") // RFC 3986 unreserved characters
        
        let encoded = string.addingPercentEncoding(withAllowedCharacters: allowed) ?? string
        // Ensure we follow RFC 3986 for consistency with Bilibili requirements
        
        return encoded
    }
    
    static func md5(_ string: String) -> String {
        let length = Int(CC_MD5_DIGEST_LENGTH)
        var digest = [UInt8](repeating: 0, count: length)
        if let data = string.data(using: .utf8) {
            _ = data.withUnsafeBytes { body -> String in
                CC_MD5(body.baseAddress, CC_LONG(data.count), &digest)
                return ""
            }
        }
        return (0..<length).reduce("") {
            $0 + String(format: "%02x", digest[$1])
        }
    }

    static func sign(params: [String: Any], imgKey: String, subKey: String) -> [String: String] {
        let mixinKey = getMixinKey(orig: imgKey + subKey)
        let currTime = Int(Date().timeIntervalSince1970)
        
        var sortedParams = params
        sortedParams["wts"] = currTime
        
        // Sort keys
        let keys = sortedParams.keys.sorted()
        
        var queryParts: [String] = []
        for key in keys {
            if let value = sortedParams[key] {
                let strValue = "\(value)"

                
                queryParts.append("\(encodeURIComponent(key))=\(encodeURIComponent(strValue))")
            }
        }
        
        let queryStr = queryParts.joined(separator: "&")
        let w_rid = md5(queryStr + mixinKey)
        
        var finalMap: [String: String] = [:]
        for (k, v) in sortedParams {
            finalMap[k] = "\(v)"
        }
        finalMap["w_rid"] = w_rid
        
        return finalMap
    }
    
    static func extractKey(url: String) -> String {

        guard let lastComponent = url.split(separator: "/").last else { return "" }
        let filename = String(lastComponent)
        if let dotIndex = filename.lastIndex(of: ".") {
            return String(filename[..<dotIndex])
        }
        return filename
    }
}
