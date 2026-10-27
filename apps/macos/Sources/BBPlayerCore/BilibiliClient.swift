import Foundation

public actor BilibiliClient: MediaSourceProvider {
    private let session: URLSession
    private var cookie: String
    private var keys: (String, String, Date)?
    private let importSearchInterval: Duration
    private var nextImportSearch = ContinuousClock.now
    public init(cookie: String = "", session: URLSession? = nil, importSearchInterval: Duration = .seconds(4)) {
        self.importSearchInterval = importSearchInterval
        self.cookie = cookie
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = 20
        self.session = session ?? URLSession(configuration: configuration, delegate: BiliRedirectPolicy(), delegateQueue: nil)
    }
    public func setCookie(_ value: String) { cookie = value; keys = nil }
    public func headers(authenticated: Bool = true) -> [String: String] {
        var result = ["Referer": "https://www.bilibili.com/", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"]
        if authenticated && !cookie.isEmpty { result["Cookie"] = cookie }
        return result
    }
    public func request(_ path: String, parameters: [String: String] = [:], signed: Bool = false, authenticated: Bool = true) async throws -> [String: Any] {
        var parameters = parameters
        if signed {
            let (image, sub) = try await wbiKeys()
            parameters = WBI.sign(parameters, imageKey: image, subKey: sub)
        }
        guard var components = URLComponents(string: path.hasPrefix("https://") ? path : "https://api.bilibili.com" + path) else { throw APIError.invalidResponse }
        components.percentEncodedQuery = parameters.keys.sorted().map { WBI.encode($0) + "=" + WBI.encode(parameters[$0]!) }.joined(separator: "&")
        guard let url = components.url, let host = url.host, host == "bilibili.com" || host.hasSuffix(".bilibili.com"), url.scheme == "https" else { throw APIError.invalidResponse }
        var request = URLRequest(url: url)
        for (key, value) in headers(authenticated: authenticated) { request.setValue(value, forHTTPHeaderField: key) }
        let data: Data
        let response: URLResponse
        do { (data, response) = try await session.data(for: request) }
        catch is CancellationError { throw APIError.cancelled }
        catch { if (error as NSError).code == NSURLErrorCancelled { throw APIError.cancelled }; throw APIError.network("request") }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.remote(http.statusCode, "请求失败（HTTP \(http.statusCode)）") }
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw APIError.invalidResponse }
        let code = object.int("code")
        if code == -101 || code == -111 { throw APIError.loginRequired }
        guard code == 0 else { throw APIError.remote(code, object.string("message")) }
        if let data = object["data"] as? [String: Any] { return data }
        if let list = object["data"] as? [[String: Any]] { return ["_items": list] }
        return object["result"] as? [String: Any] ?? [:]
    }
    public func danmaku(cid: Int64, segment: Int) async throws -> [DanmakuComment] {
        guard cid > 0, segment > 0 else { throw APIError.invalidResponse }
        let url = URL(string: "https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=\(cid)&segment_index=\(segment)")!
        var request = URLRequest(url: url)
        for (key, value) in headers() { request.setValue(value, forHTTPHeaderField: key) }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw APIError.unavailable("弹幕暂时无法获取，音乐播放不受影响。") }
        return try DanmakuParser.parse(data)
    }
    private func wbiKeys() async throws -> (String, String) {
        if let keys, Date().timeIntervalSince(keys.2) < 1800 { return (keys.0, keys.1) }
        // The nav endpoint returns WBI image keys even for anonymous sessions.
        var request = URLRequest(url: URL(string: "https://api.bilibili.com/x/web-interface/nav")!)
        for (key, value) in headers() { request.setValue(value, forHTTPHeaderField: key) }
        let (data, _) = try await session.data(for: request)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let body = object["data"] as? [String: Any], let image = body["wbi_img"] as? [String: Any] else { throw APIError.invalidResponse }
        let first = WBI.key(from: image.string("img_url")), second = WBI.key(from: image.string("sub_url"))
        guard first.count == 32, second.count == 32 else { throw APIError.invalidResponse }
        keys = (first, second, Date()); return (first, second)
    }
    public func profile() async throws -> BilibiliProfile {
        let body = try await request("/x/web-interface/nav")
        guard body["isLogin"] as? Bool == true else { throw APIError.loginRequired }
        return BilibiliProfile(id: body.int64("mid"), name: body.string("uname"), avatarURL: Self.imageURL(body.string("face")))
    }
    public func search(_ query: String, page: Int = 1) async throws -> [Track] {
        try await search(query, page: page, authenticated: true)
    }
    public func search(_ query: String, page: Int = 1, authenticated: Bool) async throws -> [Track] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if let bvid = MediaLink.bvid(in: query) {
            let track = try await video(bvid: bvid)
            if let part = URLComponents(string: query)?.queryItems?.first(where: { $0.name == "p" })?.value.flatMap(Int.init), part > 1 {
                let pages = try await pages(track)
                guard pages.indices.contains(part - 1) else { throw APIError.unavailable("分 P 编号超出视频范围。") }
                return [pages[part - 1]]
            }
            return [track]
        }
        if query.lowercased().hasPrefix("av"), let aid = Int64(query.dropFirst(2)) {
            return [Self.track(try await request("/x/web-interface/wbi/view", parameters: ["aid": String(aid)], signed: true))]
        }
        if let url = URL(string: query), url.host == "b23.tv" {
            var request = URLRequest(url: url); request.httpMethod = "HEAD"
            let (_, response) = try await session.data(for: request)
            guard let destination = response.url?.absoluteString, MediaLink.bvid(in: destination) != nil else { throw APIError.unavailable("无法解析该 B 站短链接。") }
            return try await search(destination, page: page, authenticated: authenticated)
        }
        let body = try await request("/x/web-interface/wbi/search/type", parameters: ["keyword": query, "search_type": "video", "page": String(page)], signed: true, authenticated: authenticated)
        if body["result"] == nil, let count = body["numResults"] as? Int, count == 0 { return [] }
        guard let results = body["result"] as? [[String: Any]] else { throw APIError.invalidResponse }
        return results.filter { !$0.string("bvid").isEmpty && ($0.string("type").isEmpty || $0.string("type") == "video") }.map(Self.track)
    }
    public func searchForImport(_ query: String) async throws -> [Track] {
        let clock = ContinuousClock()
        let scheduled = max(clock.now, nextImportSearch)
        nextImportSearch = scheduled.advanced(by: importSearchInterval)
        try await clock.sleep(until: scheduled)
        try Task.checkCancellation()
        return try await search(query, authenticated: false)
    }
    public func importCandidates(for song: ExternalSong) async throws -> [Track] {
        var results = try await searchForImport(song.title + " " + song.artist)
        try Task.checkCancellation()
        var ranked = Matching.rankedCandidates(song, results)
        if ranked.first.map({ Matching.score(song, $0) < 0.72 }) ?? true {
            results += try await searchForImport(song.title)
            try Task.checkCancellation()
            ranked = Matching.rankedCandidates(song, results)
        }
        return Array(ranked.prefix(8))
    }
    public func video(bvid: String) async throws -> Track {
        do { return Self.track(try await request("/x/web-interface/view", parameters: ["bvid": bvid])) }
        catch APIError.remote(412, _) {
            if let body = try? await request("/x/web-interface/wbi/view", parameters: ["bvid": bvid], signed: true) { return Self.track(body) }
            let pages = try await pages(Track(bvid: bvid, title: bvid))
            guard let first = pages.first else { throw APIError.unavailable("该视频没有可播放的分 P。") }
            return first
        }
    }
    public func pages(_ track: Track) async throws -> [Track] {
        let body = try await request("/x/player/pagelist", parameters: ["bvid": track.bvid])
        return body.array("_items").map { track.withPage(cid: $0.int64("cid"), title: $0.string("part"), duration: $0.double("duration")) }
    }
    public func resolve(_ input: Track) async throws -> ResolvedAudio {
        var track = input
        if track.cid == nil {
            let pages = try await pages(track)
            guard let first = pages.first else { throw APIError.unavailable("该视频没有可播放的分 P。") }
            track = track.withPage(cid: first.cid!, title: nil, duration: first.duration)
        }
        let body = try await request("/x/player/wbi/playurl", parameters: ["bvid": track.bvid, "cid": String(track.cid!), "fnval": "4048", "fnver": "0", "fourk": "1", "qlt": "30280", "voice_balance": "1"], signed: true)
        let streams = body.object("dash").array("audio").filter {
            let codec = $0.string("codecs").lowercased()
            return codec.isEmpty || codec.hasPrefix("mp4a")
        }.sorted { $0.int("bandwidth") > $1.int("bandwidth") }
        guard let stream = streams.first, let url = URL(string: stream.string("baseUrl", fallback: "base_url")), url.scheme == "https" else { throw APIError.unavailable("没有可用的常规 AAC 音轨。") }
        let backups = (stream["backupUrl"] ?? stream["backup_url"]) as? [String] ?? []
        let volume = body.object("volume")
        return ResolvedAudio(track: track, url: url, backupURLs: backups.compactMap(URL.init(string:)), headers: headers(authenticated: false),
            measuredLoudness: volume["measured_i"] as? Double, targetLoudness: volume["target_i"] as? Double,
            chapters: [], streamInfo: AudioStreamInfo(codec: stream.string("codecs"), bitrate: stream.int("bandwidth"), sampleRate: max(stream.int("audioSampleRate"), stream.int("audio_sample_rate"))))
    }
    public func chapters(for track: Track) async throws -> [Chapter] {
        guard let cid = track.cid else { return [] }
        let metadata = try await request("/x/player/wbi/v2", parameters: ["bvid": track.bvid, "cid": String(cid)], signed: true)
        return Self.parseChapters(metadata)
    }
    public static func parseChapters(_ metadata: [String: Any]) -> [Chapter] {
        let direct = metadata.array("view_points")
        let points = direct.isEmpty ? metadata.object("view_points").array("points") : direct
        return points.compactMap { value in
            let start = value.double("from"), end = value.double("to")
            guard start >= 0, end > start else { return nil }
            return Chapter(title: value.string("content"), start: start, end: end)
        }.sorted { $0.start < $1.start }
    }
    public func favoriteFolders(userID: Int64) async throws -> [Playlist] {
        let body = try await request("/x/v3/fav/folder/created/list-all", parameters: ["up_mid": String(userID)])
        return body.array("list").map { Playlist(id: "favorite:\($0.int64("id"))", title: $0.string("title"), count: $0.int("media_count"), coverURL: Self.imageURL($0.string("cover")), kind: "favorite", remoteID: String($0.int64("id")), ownerID: userID) }
    }
    public func collections(userID: Int64, page: Int = 1) async throws -> [Playlist] {
        let body = try await request("/x/v3/fav/folder/collected/list", parameters: ["up_mid": String(userID), "pn": String(page), "ps": "20", "platform": "web"])
        return body.array("list").map { Playlist(id: "collection:\($0.int64("id"))", title: $0.string("title"), count: $0.int("media_count"), coverURL: Self.imageURL($0.string("cover")), kind: "collection", remoteID: String($0.int64("id")), ownerID: userID) }
    }
    public func remoteTracks(_ playlist: Playlist, page: Int = 1) async throws -> [Track] {
        guard let id = playlist.remoteID else { return [] }
        if playlist.kind == "collection" {
            let body = try await request("/x/space/fav/season/list", parameters: ["season_id": id, "pn": String(page), "ps": "30"])
            return body.array("medias").map(Self.track)
        }
        let body = try await request("/x/v3/fav/resource/list", parameters: ["media_id": id, "pn": String(page), "ps": "30", "platform": "web"])
        return body.array("medias").map(Self.track)
    }
    public func watchLater() async throws -> [Track] {
        try await request("/x/v2/history/toview").array("list").map(Self.track)
    }
    public func following(userID: Int64, page: Int = 1) async throws -> [FollowingProfile] {
        let body = try await request("/x/relation/followings", parameters: ["vmid": String(userID), "pn": String(page), "ps": "50", "order": "desc"])
        return body.array("list").map { FollowingProfile(id: $0.int64("mid"), name: $0.string("uname"), avatar: Self.imageURL($0.string("face"))) }
    }
    public func uploaderTracks(userID: Int64, page: Int = 1) async throws -> [Track] {
        let body = try await request("/x/space/wbi/arc/search", parameters: ["mid": String(userID), "pn": String(page), "ps": "30", "order": "pubdate"], signed: true)
        return body.object("list").array("vlist").map(Self.track)
    }
    public func generateQR() async throws -> QRLogin {
        let body = try await request("https://passport.bilibili.com/x/passport-login/web/qrcode/generate", authenticated: false)
        guard let url = URL(string: body.string("url")) else { throw APIError.invalidResponse }
        return QRLogin(key: body.string("qrcode_key"), url: url)
    }
    public func pollQR(_ key: String) async throws -> QRStatus {
        var components = URLComponents(string: "https://passport.bilibili.com/x/passport-login/web/qrcode/poll")!
        components.queryItems = [URLQueryItem(name: "qrcode_key", value: key)]
        var request = URLRequest(url: components.url!)
        for (name, value) in headers(authenticated: false) { request.setValue(value, forHTTPHeaderField: name) }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse, let object = try JSONSerialization.jsonObject(with: data) as? [String: Any], let body = object["data"] as? [String: Any] else { throw APIError.invalidResponse }
        let code = body.int("code")
        if code == 0 {
            let fields = response.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) }
            let cookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: response.url!)
            guard !cookies.isEmpty else { throw APIError.unavailable("登录成功，但未收到凭据，请重试。") }
            return .success(cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; "))
        }
        return code == 86038 ? .expired : code == 86090 ? .scanned : .waiting
    }
    public nonisolated static func track(_ object: [String: Any]) -> Track {
        let owner = object.object("owner"), upper = object.object("upper")
        let duration = (object["duration"] as? String).map(MediaLink.duration) ?? (object["length"] as? String).map(MediaLink.duration) ?? object.double("duration")
        return Track(bvid: object.string("bvid"), cid: object["cid"] as? Int64, title: MediaLink.cleanHTML(object.string("title")),
            artist: object.string("author").nonEmpty ?? owner.string("name").nonEmpty ?? upper.string("name"),
            coverURL: imageURL(object.string("pic").nonEmpty ?? object.string("cover")), duration: duration)
    }
    public nonisolated static func imageURL(_ text: String) -> URL? {
        guard !text.isEmpty else { return nil }
        return URL(string: text.hasPrefix("//") ? "https:" + text : text.replacingOccurrences(of: "http://", with: "https://"))
    }
}

public struct FollowingProfile: Identifiable, Sendable { public var id: Int64; public var name: String; public var avatar: URL? }
public struct QRLogin: Sendable { public var key: String; public var url: URL }
public enum QRStatus: Sendable { case waiting, scanned, expired, success(String) }

extension Dictionary where Key == String, Value == Any {
    public func object(_ key: String) -> [String: Any] { self[key] as? [String: Any] ?? [:] }
    public func array(_ key: String) -> [[String: Any]] { self[key] as? [[String: Any]] ?? [] }
    public func string(_ key: String, fallback: String? = nil) -> String { self[key] as? String ?? fallback.flatMap { self[$0] as? String } ?? "" }
    public func int(_ key: String) -> Int { (self[key] as? NSNumber)?.intValue ?? Int(self[key] as? String ?? "") ?? 0 }
    public func int64(_ key: String) -> Int64 { (self[key] as? NSNumber)?.int64Value ?? Int64(self[key] as? String ?? "") ?? 0 }
    public func double(_ key: String) -> Double { (self[key] as? NSNumber)?.doubleValue ?? Double(self[key] as? String ?? "") ?? 0 }
}
extension String { public var nonEmpty: String? { isEmpty ? nil : self } }

private final class BiliRedirectPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        guard let url = request.url, url.scheme == "https", let host = url.host,
              host == "bilibili.com" || host.hasSuffix(".bilibili.com") || host == "b23.tv" else { completionHandler(nil); return }
        completionHandler(request)
    }
}
