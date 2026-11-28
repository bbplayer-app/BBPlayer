import Foundation

enum BilibiliError: Error {
    case invalidUrl
    case requestFailed
    case decodingFailed
    case navInfoMissing
    case noData
    case noAudioStream
    case apiError(code: Int, message: String)
    case httpError(status: Int)
}

extension BilibiliError: LocalizedError {
    /// JS picks its message by matching these phrases, the same ones the Android errors use.
    var errorDescription: String? {
        switch self {
        case .apiError(let code, let message):
            return "Bilibili API Error: code=\(code) msg=\(message)"
        case .httpError(let status):
            return "Bilibili API Http Error: \(status)"
        case .noAudioStream:
            return "AudioStreamError: the response has no audio stream"
        case .invalidUrl, .requestFailed, .decodingFailed, .navInfoMissing, .noData:
            return "Bilibili API Logic Error: \(self)"
        }
    }
}

struct BilibiliNavResponse: Codable {
    let code: Int
    let data: NavData?
    
    struct NavData: Codable {
        let wbi_img: WbiImg?
        let isLogin: Bool?
    }
    
    struct WbiImg: Codable {
        let img_url: String
        let sub_url: String
    }
}

struct BilibiliPlayUrlResponse: Codable {
    let code: Int
    let message: String?
    let data: PlayUrlData?
    
    struct PlayUrlData: Codable {
        let durl: [Durl]?
        let dash: Dash?
        let volume: Volume?
    }

    struct Volume: Codable {
        let measured_i: Double
    }
    
    struct Durl: Codable {
        let url: String
        let backup_url: [String]?
    }
    
    struct Dash: Codable {
        let audio: [DashAudio]?
        /// Hi-Res and Dolby only come with a 大会员 account, and only for some videos.
        let flac: Flac?
        let dolby: Dolby?

        enum CodingKeys: String, CodingKey {
            case audio, flac, dolby
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            audio = try container.decodeIfPresent([DashAudio].self, forKey: .audio)
            // A shape these don't expect costs only their quality, never the whole answer.
            flac = try? container.decodeIfPresent(Flac.self, forKey: .flac)
            dolby = try? container.decodeIfPresent(Dolby.self, forKey: .dolby)
        }
    }

    struct Flac: Codable {
        let audio: DashAudio?
    }

    struct Dolby: Codable {
        let audio: [DashAudio]?
    }

    struct DashAudio: Codable {
        let id: Int
        let baseUrl: String
        let backupUrl: [String]?
        let segment_base: SegmentBase?
        /// In bits per second.
        let bandwidth: Int?
        let codecs: String?

        enum CodingKeys: String, CodingKey {
            case id, baseUrl, backupUrl, segment_base, bandwidth, codecs
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(Int.self, forKey: .id)
            baseUrl = try container.decode(String.self, forKey: .baseUrl)
            backupUrl = try container.decodeIfPresent([String].self, forKey: .backupUrl)
            segment_base = try container.decodeIfPresent(SegmentBase.self, forKey: .segment_base)
            // Only the quality panel shows these, so a surprise in them must not cost the stream.
            bandwidth = try? container.decodeIfPresent(Int.self, forKey: .bandwidth)
            codecs = try? container.decodeIfPresent(String.self, forKey: .codecs)
        }
    }

    struct SegmentBase: Codable {
        let initialization: String
        let index_range: String
    }
}


struct BilibiliPageListResponse: Codable {
    let code: Int
    let message: String?
    let data: [BilibiliPageListItem]?
}

struct BilibiliPageListItem: Codable {
    let cid: Int
    let page: Int
    let part: String
}

/// A playable stream and its mirrors, best first.
struct BilibiliStream {
    let urls: [String]
    /// Where a DASH audio file keeps its header and index; nil for a plain MP4.
    let segmentBase: BilibiliPlayUrlResponse.SegmentBase?
    /// Bilibili's integrated loudness for this stream, in LUFS.
    let measuredLoudness: Double?
    /// What the quality panel shows about the stream.
    var kind: AudioQualityKind = .durl
    var streamId: Int? = nil
    var codecs: String? = nil
    var bandwidth: Int? = nil
    /// What the video offers; empty for the MP4, which comes without that list.
    var availableQualities: [AudioQualityPreference] = []
}

class BilibiliApi {
    static let shared = BilibiliApi()
    
    /// What Bilibili's API and CDN expect to see from a browser. Lookups, playback and
    /// downloads all send this one copy.
    static let browserHeaders = [
        "Referer": "https://www.bilibili.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ]

    private let session = URLSession.shared
    
    // Constants for API parameters
    private let BiliQualityHigh = 80 // 1080P
    /// DASH with every format flag, as Android sends. With fewer flags the answer can leave out
    /// the Hi-Res and Dolby streams.
    private let BiliFnvalDash = 4048
    private let FnvalMp4 = 1
    private let FnverDefault = 0
    private let FourKEnabled = 1
    private let PlatformHtml5 = "html5"

    private struct WbiKeys {
        let img: String
        let sub: String
        let fetchedAt: Date
    }

    private typealias NavCompletion = (Result<Void, Error>) -> Void

    /// Lookups come from the player, from every download slot and from JS at the same time,
    /// so the state below is only read or written while holding this.
    private let stateLock = NSLock()
    private var storedCookie: String?
    private var storedWbiKeys: WbiKeys?
    /// The callers waiting on the key refresh that is in flight, or nil when there is none.
    private var navWaiters: [NavCompletion]?

    private var cookie: String? {
        return stateLock.withLock { storedCookie }
    }
    
    func setCookie(_ cookie: String) {
        stateLock.withLock { storedCookie = cookie }
    }

    /// An HTTP error's body usually isn't the JSON these responses are decoded as.
    private static func httpFailure(_ response: URLResponse?) -> BilibiliError? {
        guard let status = (response as? HTTPURLResponse)?.statusCode, !(200..<300).contains(status) else { return nil }
        return .httpError(status: status)
    }

    /// Orders a stream's mirrors the same way the Android player does.
    private func streamUrls(primary: String, backups: [String]?) -> [String] {
        var seen = Set<String>()
        let urls = ([primary] + (backups ?? [])).filter { !$0.isEmpty && seen.insert($0).inserted }
        let regular = urls.filter { !isMcdnUrl($0) }
        let mcdn = urls.filter { isMcdnUrl($0) }
        let preference = GeneralStorage.shared.preferredBilibiliCdn
        guard preference != "auto" else { return regular + mcdn }
        let preferred = regular.filter { matchesCdn($0, preference: preference) }
        let remaining = regular.filter { !matchesCdn($0, preference: preference) }
        return preferred + remaining + mcdn
    }

    private func matchesCdn(_ url: String, preference: String) -> Bool {
        let host = URL(string: url)?.host?.lowercased() ?? ""
        switch preference {
        case "akamai": return host == "upos-hz-mirrorakam.akamaized.net"
        case "ali": return host.hasSuffix(".bilivideo.com") && host.hasPrefix("upos-sz-mirrorali")
        case "tencent": return host.hasSuffix(".bilivideo.com") &&
            (host.hasPrefix("upos-sz-mirrorcos") || host == "upos-tf-all-tx.bilivideo.com")
        case "huawei": return host.hasSuffix(".bilivideo.com") &&
            (host.hasPrefix("upos-sz-mirrorhw") || host.hasPrefix("upos-sz-mirror08") || host == "upos-tf-all-hw.bilivideo.com")
        default: return false
        }
    }

    private func isMcdnUrl(_ url: String) -> Bool {
        guard let components = URLComponents(string: url) else { return false }
        let host = components.host?.lowercased() ?? ""
        return components.queryItems?.contains { $0.name == "os" && $0.value == "mcdn" } == true ||
            host.range(of: #"(^|\.)mcdn\.bilivideo\.(com|cn|net)$"#, options: .regularExpression) != nil ||
            (host.range(of: #"^(?:\d{1,3}\.){3}\d{1,3}$"#, options: .regularExpression) != nil &&
                components.path.range(of: #"^/v\d+/resource(?:/.*)?$"#, options: .regularExpression) != nil)
    }
    
    func getPageList(bvid: String, completion: @escaping (Result<Int, Error>) -> Void) {
         guard var components = URLComponents(string: "https://api.bilibili.com/x/player/pagelist") else {
             completion(.failure(BilibiliError.invalidUrl))
             return
         }
         components.queryItems = [URLQueryItem(name: "bvid", value: bvid)]
         
         guard let url = components.url else {
             completion(.failure(BilibiliError.invalidUrl))
             return
         }
         
         var request = URLRequest(url: url)
         request.httpMethod = "GET"
         if let cookie = cookie {
             request.setValue(cookie, forHTTPHeaderField: "Cookie")
         }
         

         
         session.dataTask(with: request) { data, response, error in
             if let error = error {
                 completion(.failure(error))
                 return
             }

             if let failure = Self.httpFailure(response) {
                 completion(.failure(failure))
                 return
             }
             
             guard let data = data else {
                 completion(.failure(BilibiliError.noData))
                 return
             }
             
             do {
                 let apiResponse = try JSONDecoder().decode(BilibiliPageListResponse.self, from: data)
                 if apiResponse.code != 0 {
                     completion(.failure(BilibiliError.apiError(code: apiResponse.code, message: apiResponse.message ?? "Unknown error")))
                     return
                 }
                 
                 if let firstPage = apiResponse.data?.first {
                     completion(.success(firstPage.cid))
                 } else {
                     completion(.failure(BilibiliError.decodingFailed))
                 }
             } catch {
                 completion(.failure(error))
             }
         }.resume()
    }
    
    /// Fetches today's WBI keys. Lookups that ask while a refresh is in flight share its result.
    private func refreshNavInfo(completion: @escaping NavCompletion) {
        let alreadyRefreshing: Bool = stateLock.withLock {
            if navWaiters != nil {
                navWaiters?.append(completion)
                return true
            }
            navWaiters = [completion]
            return false
        }
        guard !alreadyRefreshing else { return }

        let urlStr = "https://api.bilibili.com/x/web-interface/nav"
        guard let url = URL(string: urlStr) else {
            finishNavRefresh(.failure(BilibiliError.invalidUrl))
            return
        }
        
        var request = URLRequest(url: url)
        if let cookie = cookie {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }
        Self.browserHeaders.forEach { request.setValue($1, forHTTPHeaderField: $0) }

        session.dataTask(with: request) { data, response, error in
            if let error = error {
                self.finishNavRefresh(.failure(error))
                return
            }

            if let failure = Self.httpFailure(response) {
                self.finishNavRefresh(.failure(failure))
                return
            }

            guard let data = data else {
                self.finishNavRefresh(.failure(BilibiliError.requestFailed))
                return
            }

            do {
                let navResponse = try JSONDecoder().decode(BilibiliNavResponse.self, from: data)
                if let wbiImg = navResponse.data?.wbi_img {
                    let keys = WbiKeys(img: WbiUtil.extractKey(url: wbiImg.img_url), sub: WbiUtil.extractKey(url: wbiImg.sub_url), fetchedAt: Date())
                    self.stateLock.withLock { self.storedWbiKeys = keys }
                    self.finishNavRefresh(.success(()))
                } else {
                    self.finishNavRefresh(.failure(BilibiliError.navInfoMissing))
                }
            } catch {
                self.finishNavRefresh(.failure(error))
            }
        }.resume()
    }

    /// Answers everyone who waited on the refresh. They ask for the keys again, so none of
    /// them may be called while the lock is held.
    private func finishNavRefresh(_ result: Result<Void, Error>) {
        let waiters: [NavCompletion] = stateLock.withLock {
            defer { navWaiters = nil }
            return navWaiters ?? []
        }
        waiters.forEach { $0(result) }
    }
    
    /// Resolves a video to the audio stream that best matches `quality`, or to the progressive MP4
    /// when asked or when none of its audio streams can be played.
    func getPlayStream(bvid: String, cid: String, audioOnly: Bool = true, quality: AudioQualityPreference = .high,
                       completion: @escaping (Result<BilibiliStream, Error>) -> Void) {
        // voice_balance is what makes the response include the loudness data.
        let common: [String: Any] = ["bvid": bvid, "cid": cid, "fnver": FnverDefault, "fourk": FourKEnabled, "voice_balance": 1]
        guard audioOnly else {
            requestMp4Stream(common, completion: completion)
            return
        }

        requestPlayUrl(common.merging(["fnval": BiliFnvalDash]) { $1 }) { result in
            switch result {
            case .success(let data):
                guard let dash = data.dash, let choice = Self.chooseAudio(in: dash, quality: quality),
                      let segmentBase = choice.audio.segment_base else {
                    self.requestMp4Stream(common, completion: completion)
                    return
                }
                let audio = choice.audio
                let offered = AudioStreamChooser.offeredQualities(aacIds: dash.audio?.map(\.id) ?? [],
                                                                  hasHiRes: dash.flac?.audio != nil,
                                                                  hasDolby: !(dash.dolby?.audio ?? []).isEmpty)
                let urls = self.streamUrls(primary: audio.baseUrl, backups: audio.backupUrl)
                completion(.success(BilibiliStream(urls: urls, segmentBase: segmentBase, measuredLoudness: data.volume?.measured_i,
                                                   kind: choice.kind, streamId: audio.id, codecs: audio.codecs,
                                                   bandwidth: audio.bandwidth, availableQualities: offered)))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /// Picks the audio stream for `quality`, and logs what the video offered by id and codec only.
    private static func chooseAudio(in dash: BilibiliPlayUrlResponse.Dash,
                                    quality: AudioQualityPreference) -> (audio: BilibiliPlayUrlResponse.DashAudio, kind: AudioQualityKind)? {
        typealias Audio = BilibiliPlayUrlResponse.DashAudio
        func candidate(_ audio: Audio) -> AudioStreamCandidate<Audio> {
            return AudioStreamCandidate(stream: audio, id: audio.id, playable: audio.segment_base != nil)
        }
        let aac = dash.audio ?? []
        let dolby = dash.dolby?.audio ?? []
        let choice = AudioStreamChooser.choose(quality, aac: aac.map(candidate), hiRes: dash.flac?.audio.map(candidate),
                                               dolby: dolby.map(candidate))

        func describe(_ streams: [Audio]) -> String {
            guard !streams.isEmpty else { return "none" }
            return streams.map { "\($0.id)/\($0.codecs ?? "?")/\($0.segment_base == nil ? "no index" : "indexed")" }
                .joined(separator: " ")
        }
        let taken = choice.map { "\($0.kind.rawValue) \($0.candidate.id)" } ?? "the MP4"
        NSLog("[OrpheusQuality] asked %@ | aac %@ | hires %@ | dolby %@ | took %@",
              quality.rawValue, describe(aac), describe(dash.flac?.audio.map { [$0] } ?? []), describe(dolby), taken)
        return choice.map { ($0.candidate.stream, $0.kind) }
    }

    private func requestMp4Stream(_ common: [String: Any], completion: @escaping (Result<BilibiliStream, Error>) -> Void) {
        let params = common.merging(["qn": BiliQualityHigh, "fnval": FnvalMp4, "platform": PlatformHtml5]) { $1 }
        requestPlayUrl(params) { result in
            switch result {
            case .success(let data):
                if let mp4 = data.durl?.first {
                    let urls = self.streamUrls(primary: mp4.url, backups: mp4.backup_url)
                    completion(.success(BilibiliStream(urls: urls, segmentBase: nil, measuredLoudness: data.volume?.measured_i)))
                } else {
                    completion(.failure(BilibiliError.noAudioStream))
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    private func requestPlayUrl(_ params: [String: Any], completion: @escaping (Result<BilibiliPlayUrlResponse.PlayUrlData, Error>) -> Void) {
        // As on Android, keys are only trusted on the day they were fetched.
        guard let keys = stateLock.withLock({ storedWbiKeys }), Calendar.current.isDateInToday(keys.fetchedAt) else {
            // Refresh nav info first
            refreshNavInfo { result in
                switch result {
                case .success:
                    self.requestPlayUrl(params, completion: completion)
                case .failure(let error):
                    completion(.failure(error))
                }
            }
            return
        }

        let signedParams = WbiUtil.sign(params: params, imgKey: keys.img, subKey: keys.sub)
        
        guard var components = URLComponents(string: "https://api.bilibili.com/x/player/wbi/playurl") else {
             completion(.failure(BilibiliError.invalidUrl))
             return
        }
        components.queryItems = signedParams.map { URLQueryItem(name: $0.key, value: $0.value) }
        
        
        guard let url = components.url else {
             completion(.failure(BilibiliError.invalidUrl))
             return
        }
        
        var request = URLRequest(url: url)
        if let cookie = cookie {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }
        Self.browserHeaders.forEach { request.setValue($1, forHTTPHeaderField: $0) }

        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            if let failure = Self.httpFailure(response) {
                completion(.failure(failure))
                return
            }

            guard let data = data else {
                completion(.failure(BilibiliError.requestFailed))
                return
            }

            do {
                let playUrlResponse = try JSONDecoder().decode(BilibiliPlayUrlResponse.self, from: data)
                
                if playUrlResponse.code != 0 {
                     completion(.failure(BilibiliError.apiError(code: playUrlResponse.code, message: playUrlResponse.message ?? "Unknown Error")))
                     return
                }

                if let playUrlData = playUrlResponse.data {
                    completion(.success(playUrlData))
                } else {
                    completion(.failure(BilibiliError.decodingFailed))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
