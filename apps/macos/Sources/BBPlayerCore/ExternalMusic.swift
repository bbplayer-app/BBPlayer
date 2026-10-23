import Foundation
import CommonCrypto

public struct ExternalSong: Codable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var artist: String
    public var duration: Double
    public var source: String
}
public struct ImportMatch: Codable, Identifiable, Sendable {
    public var id: String { song.id }
    public var song: ExternalSong
    public var candidates: [Track] = []
    public var selected: Int?
    public var score: Double = 0
    public var error: String?
    public var reviewed = false
    public var track: Track? { selected.flatMap { candidates.indices.contains($0) ? candidates[$0] : nil } }
    public init(song: ExternalSong) { self.song = song }
}
public struct ImportJob: Codable, Identifiable, Sendable {
    public var id = UUID().uuidString
    public var title: String
    public var matches: [ImportMatch]
    public var cursor = 0
    public var saved = false
    public init(title: String, matches: [ImportMatch]) { self.title = title; self.matches = matches }
}
public struct LyricCandidate: Identifiable, Sendable {
    public var id: String
    public var title: String
    public var artist: String
    public var duration: Double
    public var source: String
}

public enum Matching {
    public static func normalize(_ text: String) -> String {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .filter { $0.isLetter || $0.isNumber }
    }
    public static func similarity(_ lhs: String, _ rhs: String) -> Double {
        let a = Array(normalize(lhs).prefix(300)), b = Array(normalize(rhs).prefix(300))
        guard !a.isEmpty, !b.isEmpty else { return 0 }
        var previous = [Int](repeating: 0, count: b.count + 1)
        for character in a {
            var current = [Int](repeating: 0, count: b.count + 1)
            for index in b.indices { current[index + 1] = character == b[index] ? previous[index] + 1 : max(previous[index + 1], current[index]) }
            previous = current
        }
        return Double(previous[b.count]) / Double(max(a.count, b.count))
    }
    public static func score(_ song: ExternalSong, _ track: Track) -> Double {
        let title = similarity(song.title, track.title)
        let artist = similarity(song.artist, track.title + track.artist)
        let duration = song.duration > 0 && track.duration > 0 ? exp(-pow((song.duration - track.duration) / 8, 2) / 2) : 0.5
        let penalty = ["翻唱", "现场", "加速", "降调", "remix"].contains { track.title.localizedCaseInsensitiveContains($0) && !song.title.localizedCaseInsensitiveContains($0) } ? 0.15 : 0
        return max(0, title * 0.6 + artist * 0.15 + duration * 0.25 - penalty)
    }
}

public actor ExternalMusicService {
    private let session: URLSession
    public init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 20
        configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
        session = URLSession(configuration: configuration)
    }
    private func json(_ url: URL, referer: String, body: Data? = nil, contentType: String = "application/json") async throws -> [String: Any] {
        var request = URLRequest(url: url)
        request.setValue(referer, forHTTPHeaderField: "Referer")
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        if let body { request.httpMethod = "POST"; request.httpBody = body; request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { throw APIError.network("music-provider") }
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw APIError.invalidResponse }
        return object
    }
    private func netease(_ path: String, data: [String: Any]) async throws -> [String: Any] {
        var payload = data
        payload["e_r"] = false
        payload["header"] = ["os": "iphone", "appver": "9.0.90", "osver": "", "deviceId": "BBPlayerMac", "__csrf": ""]
        let body = try NetEaseCrypto.eapi(path: path, object: payload)
        let result = try await json(URL(string: "https://interface3.music.163.com/eapi/" + path.dropFirst(5))!, referer: "https://music.163.com/", body: Data(("params=" + body).utf8), contentType: "application/x-www-form-urlencoded")
        guard result.int("code") == 200 else { throw APIError.unavailable("网易云请求失败：\(result.string("message"))") }
        return result
    }
    public func fetchPlaylist(input: String, source: String) async throws -> (String, [ExternalSong]) {
        let id: String
        if input.allSatisfy(\.isNumber), !input.isEmpty { id = input }
        else if let components = URLComponents(string: input), let value = components.queryItems?.first(where: { ["id", "disstid"].contains($0.name) })?.value { id = value }
        else if let range = input.range(of: #"(?:id=|/playlist/|/taoge/)(\d+)"#, options: .regularExpression) { id = String(input[range]).filter(\.isNumber) }
        else { throw APIError.unavailable("请输入歌单 ID 或包含 ID 的分享链接。") }
        if source == "netease" {
            let result = try await netease("/api/v6/playlist/detail", data: ["id": id, "n": "1000", "s": "0", "t": "0"])
            let playlist = result.object("playlist")
            var tracks = playlist.array("tracks")
            let ids = playlist.array("trackIds").map { $0.int64("id") }
            if ids.count > tracks.count {
                tracks.removeAll(keepingCapacity: true)
                for index in stride(from: 0, to: ids.count, by: 200) {
                    try Task.checkCancellation()
                    let batch = ids[index..<min(ids.count, index + 200)].map { ["id": $0] }
                    let details = String(data: try JSONSerialization.data(withJSONObject: batch), encoding: .utf8)!
                    tracks += try await netease("/api/v3/song/detail", data: ["c": details]).array("songs")
                }
            }
            guard !tracks.isEmpty else { throw APIError.unavailable("歌单为空、为私密歌单，或接口暂时不可用。") }
            return (playlist.string("name"), tracks.map { ExternalSong(id: "netease:\($0.int64("id"))", title: $0.string("name"), artist: $0.array("ar").map { $0.string("name") }.joined(separator: " / "), duration: $0.double("dt") / 1000, source: "netease") })
        }
        let result = try await json(URL(string: "https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_cp.fcg?id=\(id)&format=json&newsong=1&platform=jqspaframe.json")!, referer: "https://y.qq.com/")
        guard let playlist = result.object("data").array("cdlist").first else { throw APIError.unavailable("无法读取 QQ 歌单，请确认 ID 和公开状态。") }
        return (playlist.string("dissname"), playlist.array("songlist").map {
            ExternalSong(id: "qqmusic:" + $0.string("mid"), title: $0.string("name"), artist: $0.array("singer").map { $0.string("name") }.joined(separator: " / "), duration: $0.double("interval"), source: "qqmusic")
        })
    }
    public func searchLyrics(_ keyword: String, source: String) async throws -> [LyricCandidate] {
        if source == "netease" {
            let result = try await netease("/api/cloudsearch/pc", data: ["s": keyword, "type": 1, "limit": 10, "offset": 0])
            return result.object("result").array("songs").map { LyricCandidate(id: String($0.int64("id")), title: $0.string("name"), artist: $0.array("ar").map { $0.string("name") }.joined(separator: " / "), duration: $0.double("dt") / 1000, source: source) }
        }
        if source == "qqmusic" {
            let payload: [String: Any] = ["comm": ["ct": "19", "cv": "1859", "uin": "0"], "req": ["method": "DoSearchForQQMusicDesktop", "module": "music.search.SearchCgiService", "param": ["grp": 1, "num_per_page": 10, "page_num": 1, "query": keyword, "search_type": 0]]]
            let result = try await json(URL(string: "https://u.y.qq.com/cgi-bin/musicu.fcg")!, referer: "https://y.qq.com/", body: try JSONSerialization.data(withJSONObject: payload))
            return result.object("req").object("data").object("body").object("song").array("list").map { LyricCandidate(id: $0.string("mid"), title: $0.string("name"), artist: $0.array("singer").map { $0.string("name") }.joined(separator: " / "), duration: $0.double("interval"), source: source) }
        }
        var components = URLComponents(string: "https://mobilecdn.kugou.com/api/v3/search/song")!
        components.queryItems = ["keyword": keyword, "pagesize": "10", "page": "1", "version": "8990", "plat": "2", "format": "json"].map { URLQueryItem(name: $0.key, value: $0.value) }
        let result = try await json(components.url!, referer: "https://www.kugou.com/")
        return result.object("data").array("info").map { LyricCandidate(id: $0.string("hash"), title: $0.string("songname"), artist: $0.string("singername"), duration: $0.double("duration"), source: source) }
    }
    public func lyrics(_ candidate: LyricCandidate) async throws -> LyricDocument {
        if candidate.source == "netease" {
            let result = try await netease("/api/song/lyric/v1", data: ["id": candidate.id, "lv": -1, "tv": -1, "rv": -1, "kv": -1, "yv": -1, "os": "ios", "ver": 1])
            let yrc = result.object("yrc").string("lyric")
            let translation = result.object(yrc.isEmpty ? "tlyric" : "ytlrc").string("lyric")
            let romanization = result.object(yrc.isEmpty ? "romalrc" : "yromalrc").string("lyric")
            if !yrc.isEmpty { return LyricsParser.parseYRC(yrc, translation: translation, romanization: romanization) }
            return LyricsParser.parse(result.object("lrc").string("lyric"), translation: translation, romanization: romanization, source: "netease")
        }
        if candidate.source == "qqmusic" {
            let result = try await json(URL(string: "https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=\(candidate.id)&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&nobase64=1")!, referer: "https://y.qq.com/")
            return LyricsParser.parse(MediaLink.cleanHTML(result.string("lyric")), translation: MediaLink.cleanHTML(result.string("trans")), source: "qqmusic")
        }
        let result = try await json(URL(string: "https://krcs.kugou.com/search?keyword=%20-%20&ver=1&hash=\(candidate.id)&client=mobi&man=yes")!, referer: "https://www.kugou.com/")
        guard let first = result.array("candidates").first else { throw APIError.unavailable("未找到酷狗歌词。") }
        let download = try await json(URL(string: "https://lyrics.kugou.com/download?charset=utf8&accesskey=\(first.string("accesskey"))&id=\(first.string("id").nonEmpty ?? String(first.int64("id")))&client=mobi&fmt=lrc&ver=1")!, referer: "https://www.kugou.com/")
        guard let data = Data(base64Encoded: download.string("content")), let text = String(data: data, encoding: .utf8) else { throw APIError.invalidResponse }
        return LyricsParser.parse(text, source: "kugou")
    }
    public static func lyricQuery(_ title: String) -> String {
        if let range = title.range(of: "「[^」]+」", options: .regularExpression) { return String(title[range].dropFirst().dropLast()) }
        return title.replacingOccurrences(of: "【[^】]*】|\\[[^\\]]*\\]", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    public static func lyricScore(_ candidate: LyricCandidate, track: Track) -> Double {
        let query = lyricQuery(track.title)
        let title = Matching.similarity(query, candidate.title)
        let duration = track.duration > 0 && candidate.duration > 0 ? exp(-pow((candidate.duration - track.duration) / 8, 2) / 2) : 0.5
        return title * 0.75 + duration * 0.25
    }
    public func automaticLyrics(for track: Track) async throws -> LyricDocument {
        for source in ["netease", "qqmusic", "kugou"] {
            try Task.checkCancellation()
            do {
                let candidates = try await searchLyrics(Self.lyricQuery(track.title), source: source)
                if let candidate = candidates.max(by: { Self.lyricScore($0, track: track) < Self.lyricScore($1, track: track) }), Self.lyricScore(candidate, track: track) >= 0.62 {
                    let document = try await lyrics(candidate)
                    if !document.lines.isEmpty { return document }
                }
            } catch is CancellationError { throw CancellationError() } catch { continue }
        }
        throw APIError.unavailable("未找到匹配歌词，可手动搜索或粘贴 LRC / SPL。")
    }
}

public enum NetEaseCrypto {
    // Public protocol constants, not user credentials.
    public static func eapi(path: String, object: [String: Any]) throws -> String {
        let text = String(data: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes]), encoding: .utf8)!
        let digest = WBI.md5(Data(("nobody" + path + "use" + text + "md5forencrypt").utf8))
        let input = Data((path + "-36cd479b6b5-" + text + "-36cd479b6b5-" + digest).utf8)
        let key = Data("e82ckenh8dichen8".utf8)
        var output = [UInt8](repeating: 0, count: input.count + kCCBlockSizeAES128)
        var length = 0
        let status = input.withUnsafeBytes { inputBytes in key.withUnsafeBytes { keyBytes in
            CCCrypt(CCOperation(kCCEncrypt), CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding | kCCOptionECBMode), keyBytes.baseAddress, key.count, nil, inputBytes.baseAddress, input.count, &output, output.count, &length)
        } }
        guard status == kCCSuccess else { throw APIError.invalidResponse }
        return output.prefix(length).map { String(format: "%02X", $0) }.joined()
    }
}
