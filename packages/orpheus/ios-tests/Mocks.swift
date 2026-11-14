// Stand-ins for the Apple frameworks and the neighbouring Orpheus classes, so the real
// OrpheusPlayerManager, OrpheusQueueManager and GeneralStorage can run on Linux.
//
// The fake player is a model: it records what the manager asks of it and changes state only
// when a test says so. It shows what the manager does, not what AVPlayer does in return.
import Foundation
import Dispatch

// MARK: - Foundation gaps

class NSObject {
    init() {}
    func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?, context: UnsafeMutableRawPointer?) {}
}

struct NSKeyValueChangeKey: Hashable {
    let rawValue: String
}

struct NSKeyValueObservingOptions: OptionSet {
    let rawValue: Int
    static let new = NSKeyValueObservingOptions(rawValue: 1)
}

extension NotificationCenter {
    /// The harness delivers notifications by calling the handlers directly.
    func addObserver(_ observer: Any, selector: String, name: NSNotification.Name?, object: Any?) {}
}

extension NSNotification.Name {
    static let AVPlayerItemDidPlayToEndTime = NSNotification.Name("AVPlayerItemDidPlayToEndTime")
    static let AVPlayerItemFailedToPlayToEndTime = NSNotification.Name("AVPlayerItemFailedToPlayToEndTime")
}

let AVPlayerItemFailedToPlayToEndTimeErrorKey = "AVPlayerItemFailedToPlayToEndTimeErrorKey"

// MARK: - CoreMedia

typealias CMTimeScale = Int32
let NSEC_PER_SEC: UInt64 = 1_000_000_000

struct CMTime {
    var seconds: Double
    static let zero = CMTime(seconds: 0, preferredTimescale: 1)
    init(seconds: Double, preferredTimescale: CMTimeScale) {
        self.seconds = seconds
    }
}

struct TimeRangeValue {
    struct Range {
        let end: CMTime
    }
    let timeRangeValue: Range
}

// MARK: - AVFoundation

struct AVMediaType {
    static let audio = AVMediaType()
}

final class AVAssetTrack {}
final class MTAudioProcessingTap {}

final class AVMutableAudioMixInputParameters {
    var audioTapProcessor: MTAudioProcessingTap?
    init(track: AVAssetTrack) {}
}

final class AVMutableAudioMix {
    var inputParameters: [AVMutableAudioMixInputParameters] = []
}

final class AVAssetResourceLoader {
    func setDelegate(_ delegate: AnyObject?, queue: DispatchQueue?) {}
}

class AVAsset {
    func loadTracks(withMediaType type: AVMediaType, completionHandler: @escaping ([AVAssetTrack]?, Error?) -> Void) {}
}

final class AVURLAsset: AVAsset {
    let url: URL
    let resourceLoader = AVAssetResourceLoader()
    init(url: URL, options: [String: Any]?) {
        self.url = url
    }
}

final class AVPlayerItem {
    enum Status { case unknown, readyToPlay, failed }
    let asset: AVAsset
    var status: Status = .unknown
    var duration = CMTime(seconds: .nan, preferredTimescale: 1)
    var error: Error?
    var loadedTimeRanges: [TimeRangeValue] = []
    var audioMix: AVMutableAudioMix?
    /// Set by the harness when the item has played through.
    var atEnd = false

    init(asset: AVAsset) {
        self.asset = asset
    }

    var url: String { (asset as? AVURLAsset)?.url.absoluteString ?? "" }
}

final class AVPlayer {
    enum TimeControlStatus { case paused, waitingToPlayAtSpecifiedRate, playing }
    enum Status { case unknown, readyToPlay, failed }

    static var created: [AVPlayer] = []

    private(set) var currentItem: AVPlayerItem?
    private(set) var timeControlStatus: TimeControlStatus = .paused
    var status: Status = .readyToPlay
    var rate: Float = 0
    var defaultRate: Float = 1
    var volume: Float = 1
    var error: Error?
    /// The clock of the current item, moved by the harness and by seeks.
    var now: Double = 0
    /// Every call the manager makes, in order.
    var calls: [String] = []
    /// Every non-nil item ever loaded.
    var loaded: [AVPlayerItem] = []

    private var observers: [NSObject] = []
    private var periodic: ((CMTime) -> Void)?

    init() {
        AVPlayer.created.append(self)
    }

    func addObserver(_ observer: NSObject, forKeyPath keyPath: String, options: NSKeyValueObservingOptions, context: UnsafeMutableRawPointer?) {
        if !observers.contains(where: { $0 === observer }) {
            observers.append(observer)
        }
    }

    func addPeriodicTimeObserver(forInterval interval: CMTime, queue: DispatchQueue?, using block: @escaping (CMTime) -> Void) -> Any {
        periodic = block
        return 0
    }

    func currentTime() -> CMTime {
        return CMTime(seconds: currentItem == nil ? 0 : now, preferredTimescale: 1000)
    }

    func play() {
        calls.append("play")
        guard let item = currentItem, item.status != .failed, !item.atEnd else { return }
        rate = defaultRate
        set(.playing)
    }

    func pause() {
        calls.append("pause")
        rate = 0
        set(.paused)
    }

    func replaceCurrentItem(with item: AVPlayerItem?) {
        calls.append("replace:\(item?.url ?? "nil")")
        currentItem = item
        now = 0
        if let item = item {
            loaded.append(item)
        } else {
            rate = 0
            set(.paused)
        }
        fire("currentItem.status")
    }

    func seek(to time: CMTime) {
        calls.append("seek:\(Int(time.seconds))")
        now = time.seconds
        currentItem?.atEnd = false
    }

    func seek(to time: CMTime, completionHandler: @escaping (Bool) -> Void) {
        seek(to: time)
        completionHandler(true)
    }

    func seek(to time: CMTime, toleranceBefore: CMTime, toleranceAfter: CMTime) {
        seek(to: time)
    }

    // MARK: Driven by the harness

    private func set(_ status: TimeControlStatus) {
        guard timeControlStatus != status else { return }
        timeControlStatus = status
        fire("timeControlStatus")
    }

    private func fire(_ keyPath: String) {
        for observer in observers {
            observer.observeValue(forKeyPath: keyPath, of: self, change: nil, context: nil)
        }
    }

    /// The current item finishes loading.
    func becomeReady(duration: Double) {
        guard let item = currentItem else { return }
        item.status = .readyToPlay
        item.duration = CMTime(seconds: duration, preferredTimescale: 1000)
        fire("currentItem.status")
    }

    /// Playback moves forward and the periodic observer reports it.
    func advance(to seconds: Double) {
        now = seconds
        periodic?(currentTime())
    }

    /// The current item plays through. The caller still has to post the notification.
    func reachEnd() {
        guard let item = currentItem else { return }
        now = item.duration.seconds
        item.atEnd = true
        rate = 0
        set(.paused)
    }

    /// The current item's status turns to failed, as a dead link does at the start of a stream.
    func failItem(_ error: Error) {
        guard let item = currentItem else { return }
        item.status = .failed
        item.error = error
        rate = 0
        set(.paused)
        fire("currentItem.status")
    }

    /// Playback stalls for good while the item's status stays ready, as a dead segment does.
    func stall() {
        rate = 0
        set(.paused)
    }

    /// How many times `call` was made since the calls were last cleared.
    func count(_ call: String) -> Int {
        return calls.filter { $0 == call }.count
    }
}

final class AVAudioSession {
    struct Category { static let playback = Category() }
    struct Mode { static let `default` = Mode() }
    struct CategoryOptions: OptionSet {
        let rawValue: UInt
        static let mixWithOthers = CategoryOptions(rawValue: 1)
    }
    enum InterruptionType: UInt { case ended = 0, began = 1 }
    struct InterruptionOptions: OptionSet {
        let rawValue: UInt
        static let shouldResume = InterruptionOptions(rawValue: 1)
    }
    static let interruptionNotification = NSNotification.Name("AVAudioSessionInterruptionNotification")
    private static let instance = AVAudioSession()
    static func sharedInstance() -> AVAudioSession { instance }
    func setCategory(_ category: Category, mode: Mode, options: CategoryOptions) throws {}
    func setActive(_ active: Bool) throws {}
}

let AVAudioSessionInterruptionTypeKey = "AVAudioSessionInterruptionTypeKey"
let AVAudioSessionInterruptionOptionKey = "AVAudioSessionInterruptionOptionKey"

// MARK: - UIKit

struct UIBackgroundTaskIdentifier: Equatable {
    let rawValue: Int
    static let invalid = UIBackgroundTaskIdentifier(rawValue: 0)
}

final class UIApplication {
    static let shared = UIApplication()
    private(set) var runningTasks: Set<Int> = []
    private var nextTask = 1

    func beginBackgroundTask(withName name: String?, expirationHandler: (() -> Void)?) -> UIBackgroundTaskIdentifier {
        let id = nextTask
        nextTask += 1
        runningTasks.insert(id)
        return UIBackgroundTaskIdentifier(rawValue: id)
    }

    func endBackgroundTask(_ identifier: UIBackgroundTaskIdentifier) {
        runningTasks.remove(identifier.rawValue)
    }

    func reset() {
        runningTasks.removeAll()
    }
}

final class UIImage {
    let size = CGSize(width: 1, height: 1)
    init?(data: Data) {
        return nil
    }
}

// MARK: - MediaPlayer

enum MPRemoteCommandHandlerStatus { case success, commandFailed }

class MPRemoteCommandEvent {}

final class MPChangePlaybackPositionCommandEvent: MPRemoteCommandEvent {
    var positionTime: Double = 0
}

final class MPRemoteCommand {
    var isEnabled = false
    private(set) var handler: ((MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus)?

    @discardableResult
    func addTarget(handler: @escaping (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus) -> Any {
        self.handler = handler
        return 0
    }
}

final class MPRemoteCommandCenter {
    private static var center = MPRemoteCommandCenter()
    static func shared() -> MPRemoteCommandCenter { center }
    static func reset() { center = MPRemoteCommandCenter() }
    let togglePlayPauseCommand = MPRemoteCommand()
    let playCommand = MPRemoteCommand()
    let pauseCommand = MPRemoteCommand()
    let nextTrackCommand = MPRemoteCommand()
    let previousTrackCommand = MPRemoteCommand()
    let changePlaybackPositionCommand = MPRemoteCommand()
}

final class MPNowPlayingInfoCenter {
    private static let center = MPNowPlayingInfoCenter()
    static func `default`() -> MPNowPlayingInfoCenter { center }
    var nowPlayingInfo: [String: Any]?
}

enum MPNowPlayingInfoMediaType: UInt { case none = 0, audio = 1 }

final class MPMediaItemArtwork {
    init(boundsSize: CGSize, requestHandler: @escaping (CGSize) -> UIImage) {}
}

let MPMediaItemPropertyTitle = "title"
let MPMediaItemPropertyArtist = "artist"
let MPMediaItemPropertyPlaybackDuration = "playbackDuration"
let MPMediaItemPropertyArtwork = "artwork"
let MPNowPlayingInfoPropertyElapsedPlaybackTime = "elapsedPlaybackTime"
let MPNowPlayingInfoPropertyPlaybackRate = "playbackRate"
let MPNowPlayingInfoPropertyDefaultPlaybackRate = "defaultPlaybackRate"
let MPNowPlayingInfoPropertyMediaType = "mediaType"
let MPNowPlayingInfoPropertyIsLiveStream = "isLiveStream"
let MPNowPlayingInfoPropertyPlaybackQueueIndex = "playbackQueueIndex"
let MPNowPlayingInfoPropertyPlaybackQueueCount = "playbackQueueCount"

// MARK: - ExpoModulesCore

protocol Record {
    init()
}

protocol Enumerable {}

@propertyWrapper
struct Field<Value> {
    var wrappedValue: Value
    init(wrappedValue: Value) {
        self.wrappedValue = wrappedValue
    }
    init() where Value: ExpressibleByNilLiteral {
        self.wrappedValue = nil
    }
}

// MARK: - MMKV

final class MMKV {
    private static var stores: [String: MMKV] = [:]
    private var values: [String: Any] = [:]

    private init() {}

    private static func store(_ id: String) -> MMKV {
        if let existing = stores[id] { return existing }
        let created = MMKV()
        stores[id] = created
        return created
    }

    static func `default`() -> MMKV? { store("default") }

    convenience init?(mmapID: String) {
        self.init()
        MMKV.stores[mmapID] = self
    }

    /// Storage objects hold on to their stores, so a reset empties them in place.
    static func resetAll() {
        for store in stores.values {
            store.values.removeAll()
        }
    }

    func string(forKey key: String) -> String? { values[key] as? String }
    func bool(forKey key: String, defaultValue: Bool) -> Bool { values[key] as? Bool ?? defaultValue }
    func int32(forKey key: String, defaultValue: Int32) -> Int32 { values[key] as? Int32 ?? defaultValue }
    func int64(forKey key: String, defaultValue: Int64) -> Int64 { values[key] as? Int64 ?? defaultValue }
    func double(forKey key: String, defaultValue: Double) -> Double { values[key] as? Double ?? defaultValue }
    func data(forKey key: String) -> Data? { values[key] as? Data }
    func set(_ value: String, forKey key: String) { values[key] = value }
    func set(_ value: Bool, forKey key: String) { values[key] = value }
    func set(_ value: Int32, forKey key: String) { values[key] = value }
    func set(_ value: Int64, forKey key: String) { values[key] = value }
    func set(_ value: Double, forKey key: String) { values[key] = value }
    func set(_ value: Data, forKey key: String) { values[key] = value }
    func removeValue(forKey key: String) { values.removeValue(forKey: key) }
    func allKeys() -> [Any] { Array(values.keys) }
}

// MARK: - Neighbouring Orpheus classes

final class AudioSpectrumAnalyzer {
    static let shared = AudioSpectrumAnalyzer()
    func setEnabled(_ enabled: Bool) {}
    func createTap() -> MTAudioProcessingTap? { nil }
}

final class OrpheusDownloadManager {
    static let shared = OrpheusDownloadManager()
    var localFiles: [String: URL] = [:]
    func getDownloadedFileUrl(id: String) -> URL? { localFiles[id] }
}

struct BilibiliPlayUrlResponse {
    struct SegmentBase {
        let initialization: String
        let index_range: String
    }
}

struct BilibiliStream {
    let urls: [String]
    let segmentBase: BilibiliPlayUrlResponse.SegmentBase?
    let measuredLoudness: Double?
}

final class DashAudioPlaylistLoader {
    static let playlistUrl = URL(string: "bbplayer-dash://audio/playlist.m3u8")!
    let queue = DispatchQueue(label: "harness.dash-playlist")
    let mediaUrl: String
    init(mediaUrl: String, segmentBase: BilibiliPlayUrlResponse.SegmentBase, headers: [String: String]) {
        self.mediaUrl = mediaUrl
    }
}

/// Holds every lookup until the harness answers it, so tests decide how long a stream takes.
final class BilibiliApi {
    static let shared = BilibiliApi()
    static let browserHeaders = ["Referer": "https://www.bilibili.com/"]

    struct StreamRequest {
        let bvid: String
        let audioOnly: Bool
        let completion: (Result<BilibiliStream, Error>) -> Void
    }

    private(set) var streamRequests: [StreamRequest] = []
    private(set) var pageListRequests: [(bvid: String, completion: (Result<Int, Error>) -> Void)] = []
    /// Lookups made since the last reset, answered or not.
    private(set) var streamRequestCount = 0

    func getPageList(bvid: String, completion: @escaping (Result<Int, Error>) -> Void) {
        pageListRequests.append((bvid, completion))
    }

    func getPlayStream(bvid: String, cid: String, audioOnly: Bool = true, completion: @escaping (Result<BilibiliStream, Error>) -> Void) {
        streamRequestCount += 1
        streamRequests.append(StreamRequest(bvid: bvid, audioOnly: audioOnly, completion: completion))
    }

    /// Answers the oldest unanswered stream lookup.
    func answerStream(_ result: Result<BilibiliStream, Error>) {
        streamRequests.removeFirst().completion(result)
    }

    func answerPageList(_ result: Result<Int, Error>) {
        pageListRequests.removeFirst().completion(result)
    }

    func reset() {
        streamRequests.removeAll()
        pageListRequests.removeAll()
        streamRequestCount = 0
    }
}
