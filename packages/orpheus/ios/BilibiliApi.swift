import Foundation

enum BilibiliError: Error {
    case invalidUrl
    case requestFailed
    case decodingFailed
    case navInfoMissing
    case noData
    case apiError(code: Int, message: String)
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
    }
    
    struct Durl: Codable {
        let url: String
        let backup_url: [String]?
    }
    
    struct Dash: Codable {
        let audio: [DashAudio]?
    }
    
    struct DashAudio: Codable {
        let id: Int
        let baseUrl: String
        let backupUrl: [String]?
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

class BilibiliApi {
    static let shared = BilibiliApi()
    
    private let session = URLSession.shared
    private var cookie: String?
    
    // Constants for API parameters
    private let BiliQualityHigh = 80 // 1080P
    private let BiliFnvalDash = 16 
    private let FnvalMp4 = 1
    private let FnverDefault = 0
    private let FourKEnabled = 1
    private let PlatformHtml5 = "html5"

    private var imgKey: String?
    private var subKey: String?
    private var wbiKeysUpdatedAt: Date?
    
    func setCookie(_ cookie: String) {
        self.cookie = cookie
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
    
    func refreshNavInfo(completion: @escaping (Result<Void, Error>) -> Void) {
        let urlStr = "https://api.bilibili.com/x/web-interface/nav"
        guard let url = URL(string: urlStr) else {
            completion(.failure(BilibiliError.invalidUrl))
            return
        }
        
        var request = URLRequest(url: url)
        if let cookie = cookie {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }
        request.setValue("https://www.bilibili.com", forHTTPHeaderField: "Referer")
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        
        session.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(BilibiliError.requestFailed))
                return
            }
            
            do {
                let navResponse = try JSONDecoder().decode(BilibiliNavResponse.self, from: data)
                if let wbiImg = navResponse.data?.wbi_img {
                    self?.imgKey = WbiUtil.extractKey(url: wbiImg.img_url)
                    self?.subKey = WbiUtil.extractKey(url: wbiImg.sub_url)
                    completion(.success(()))
                } else {
                    completion(.failure(BilibiliError.navInfoMissing))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    func getPlayUrl(bvid: String, cid: String, completion: @escaping (Result<String, Error>) -> Void) {
        guard let imgKey = imgKey, let subKey = subKey else {
            // Refresh nav info first
            refreshNavInfo { result in
                switch result {
                case .success:
                    self.getPlayUrl(bvid: bvid, cid: cid, completion: completion)
                case .failure(let error):
                    completion(.failure(error))
                }
            }
            return
        }
        
        let params: [String: Any] = [
            "bvid": bvid,
            "cid": cid,
            "qn": BiliQualityHigh,
            // fnval=1 requests MP4/FLV durl list which is better for AVPlayer
            "fnval": FnvalMp4, 
            "fnver": FnverDefault,
            "fourk": FourKEnabled,
            "platform": PlatformHtml5
        ]
        
        let signedParams = WbiUtil.sign(params: params, imgKey: imgKey, subKey: subKey)
        
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
        request.setValue("https://www.bilibili.com", forHTTPHeaderField: "Referer")
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        
        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(BilibiliError.requestFailed))
                return
            }
            
            
            do {
                let playUrlResponse = try JSONDecoder().decode(BilibiliPlayUrlResponse.self, from: data)
                
                if playUrlResponse.code != 0 {
                     completion(.failure(BilibiliError.requestFailed))
                     return
                }
                
                // Prioritize Dash Audio, then Durl
                if let audioUrl = playUrlResponse.data?.dash?.audio?.first?.baseUrl {
                    completion(.success(audioUrl))
                } else if let mp4Url = playUrlResponse.data?.durl?.first?.url {
                    completion(.success(mp4Url))
                } else {
                    completion(.failure(BilibiliError.decodingFailed))
                }
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
