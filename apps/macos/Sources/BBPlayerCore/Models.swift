import Foundation

public enum LibrarySection: String, CaseIterable, Identifiable, Sendable {
    case search, playlists, favorites, collections, multipart, following, watchLater, downloads, history, profile, themes, settings, localFiles
    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .search: "搜索"
        case .playlists: "播放列表"
        case .favorites: "收藏夹"
        case .collections: "合集"
        case .multipart: "分 P"
        case .following: "我的关注"
        case .watchLater: "稍后再看"
        case .downloads: "下载"
        case .history: "听歌记录"
        case .profile: "我的"
        case .themes: "主题装扮"
        case .settings: "设置"
        case .localFiles: "本地音乐"
        }
    }
    public var symbol: String {
        switch self {
        case .search: "magnifyingglass"
        case .playlists: "music.note.list"
        case .favorites: "star.square.on.square"
        case .collections: "folder"
        case .multipart: "play.rectangle.on.rectangle"
        case .following: "person.2"
        case .watchLater: "clock"
        case .downloads: "arrow.down.circle"
        case .history: "chart.bar"
        case .profile: "person.crop.circle"
        case .themes: "paintpalette"
        case .settings: "gearshape"
        case .localFiles: "music.note.house"
        }
    }
}

public struct Track: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var bvid: String
    public var cid: Int64?
    public var title: String
    public var artist: String
    public var coverURL: URL?
    public var duration: Double
    public var source: String
    public init(bvid: String, cid: Int64? = nil, title: String, artist: String = "", coverURL: URL? = nil, duration: Double = 0, source: String = "bilibili") {
        self.bvid = bvid; self.cid = cid; self.title = title; self.artist = artist
        self.coverURL = coverURL; self.duration = duration; self.source = source
        self.id = "\(source):\(bvid):\(cid.map(String.init) ?? "video")"
    }
    public func withPage(cid: Int64, title: String?, duration: Double?) -> Track {
        Track(bvid: bvid, cid: cid, title: title ?? self.title, artist: artist, coverURL: coverURL, duration: duration ?? self.duration, source: source)
    }
}

public struct Playlist: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var title: String
    public var count: Int
    public var coverURL: URL?
    public var kind: String
    public var remoteID: String?
    public var ownerID: Int64?
    public init(id: String = UUID().uuidString, title: String, count: Int = 0, coverURL: URL? = nil, kind: String = "local", remoteID: String? = nil, ownerID: Int64? = nil) {
        self.id = id; self.title = title; self.count = count; self.coverURL = coverURL
        self.kind = kind; self.remoteID = remoteID; self.ownerID = ownerID
    }
}

public struct BilibiliProfile: Codable, Sendable {
    public var id: Int64
    public var name: String
    public var avatarURL: URL?
}

public struct Chapter: Codable, Hashable, Identifiable, Sendable {
    public var id: Double { start }
    public var title: String
    public var start: Double
    public var end: Double
    public init(title: String, start: Double, end: Double) { self.title = title; self.start = start; self.end = end }
}

public struct AudioStreamInfo: Codable, Equatable, Sendable {
    public var codec: String
    public var bitrate: Int?
    public var sampleRate: Int?
    public init(codec: String, bitrate: Int? = nil, sampleRate: Int? = nil) {
        self.codec = codec
        self.bitrate = bitrate.flatMap { $0 > 0 ? $0 : nil }
        self.sampleRate = sampleRate.flatMap { $0 > 0 ? $0 : nil }
    }
    public var summary: String {
        var parts = [codec.lowercased().hasPrefix("mp4a") ? "AAC" : codec.nonEmpty ?? "音频"]
        if let bitrate { parts.append("\(Int((Double(bitrate) / 1000).rounded())) kbps") }
        if let sampleRate { parts.append(String(format: "%g kHz", Double(sampleRate) / 1000)) }
        return parts.joined(separator: " · ")
    }
}

public struct ResolvedAudio: Sendable {
    public var track: Track
    public var url: URL
    public var backupURLs: [URL]
    public var headers: [String: String]
    public var measuredLoudness: Double?
    public var targetLoudness: Double?
    public var chapters: [Chapter]
    public var streamInfo: AudioStreamInfo?
    public init(track: Track, url: URL, backupURLs: [URL] = [], headers: [String: String] = [:], measuredLoudness: Double? = nil, targetLoudness: Double? = nil, chapters: [Chapter] = [], streamInfo: AudioStreamInfo? = nil) {
        self.track = track; self.url = url; self.backupURLs = backupURLs; self.headers = headers
        self.measuredLoudness = measuredLoudness; self.targetLoudness = targetLoudness; self.chapters = chapters
        self.streamInfo = streamInfo
    }
}

public struct OfflineAudioMetadata: Codable, Sendable {
    public var track: Track
    public var measuredLoudness: Double?
    public var targetLoudness: Double?
    public var chapters: [Chapter]
    public var streamInfo: AudioStreamInfo?
    public init(source: ResolvedAudio) { track = source.track; measuredLoudness = source.measuredLoudness; targetLoudness = source.targetLoudness; chapters = source.chapters; streamInfo = source.streamInfo }
}

public enum RepeatMode: String, Codable, CaseIterable, Sendable { case off, queue, track }
public struct PlaybackSnapshot: Codable, Sendable {
    public var queue: [Track] = []
    public var index: Int = 0
    public var position: Double = 0
    public var rate: Double = 1
    public var repeatMode: RepeatMode = .queue
    public var shuffled: Bool = false
    public init() {}
}

public struct PlayerPreferences: Codable, Sendable {
    public var autoplay = false
    public var normalization = true
    public var spectrum = true
    public var fluidBackground = true
    public var floatingLyrics = false
    public var floatingLocked = true
    public var showTranslation = true
    public var showRomanization = true
    public var prefetchNextTrack: Bool? = nil
    public var cacheLimit: Int64 = 1_073_741_824
    public var lyricOffset: Double = 0
    public var volume: Double = 0.8
    public var appearance = "system"
    public init() {}
}

public enum APIError: Error, LocalizedError, Sendable, Equatable {
    case loginRequired, unavailable(String), network(String), invalidResponse, cancelled
    case remote(Int, String)
    public var errorDescription: String? {
        switch self {
        case .loginRequired: "登录已失效，请重新登录 B 站。"
        case .unavailable(let reason): reason
        case .network: "网络请求失败，请检查连接后重试。"
        case .invalidResponse: "服务返回的数据无法识别。"
        case .cancelled: "已取消。"
        case .remote(_, let message): message
        }
    }
    public var shouldSkipTrack: Bool {
        switch self { case .unavailable: true; case .remote(let code, _): [-404, 62002, 62012].contains(code); default: false }
    }
}

public protocol MediaSourceProvider: Sendable {
    func search(_ query: String, page: Int) async throws -> [Track]
    func resolve(_ track: Track) async throws -> ResolvedAudio
    func chapters(for track: Track) async throws -> [Chapter]
}
public extension MediaSourceProvider {
    func chapters(for track: Track) async throws -> [Chapter] { [] }
}

@MainActor public protocol PlaybackEngine: AnyObject {
    var snapshot: PlaybackSnapshot { get }
    var currentTrack: Track? { get }
    var isPlaying: Bool { get }
    var position: Double { get }
    func setQueue(_ tracks: [Track], index: Int)
    func play()
    func pause()
    func seek(to seconds: Double)
    func setRate(_ rate: Double)
    func shutdown()
}

public protocol LibraryRepository: Sendable {
    func playlists() throws -> [Playlist]
    func tracks(playlistID: String, limit: Int, offset: Int) throws -> [Track]
    func savePlaylist(_ playlist: Playlist, tracks: [Track]) throws
}

public protocol SyncService: Sendable {
    var isAvailable: Bool { get }
}
public struct DeferredSyncService: SyncService {
    public let isAvailable = false
    public init() {}
}

public enum Loudness {
    /// Preserve the Android implementation's attenuation-only rule; never amplify/clip.
    public static func gain(measured: Double?, target: Double = -14) -> Float {
        guard let measured, measured.isFinite, measured != 0, target.isFinite else { return 1 }
        return Float(min(1, max(0, pow(10, (target - measured) / 20))))
    }
}

public struct ListeningAccumulator: Sendable {
    public private(set) var audibleSeconds: Double = 0
    private var lastClock: Double?
    public init() {}
    public mutating func update(clock: Double, audible: Bool) -> Double {
        defer { lastClock = audible ? clock : nil }
        guard audible, let lastClock else { return 0 }
        let delta = max(0, min(2, clock - lastClock))
        audibleSeconds += delta
        return delta
    }
}
