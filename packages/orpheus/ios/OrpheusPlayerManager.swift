import AVFoundation
import ExpoModulesCore
import MediaPlayer

class OrpheusPlayerManager: NSObject {
    static let shared = OrpheusPlayerManager()
    
    private let player: AVPlayer
    private let queueManager = OrpheusQueueManager()

    
    var repeatMode: RepeatMode = .off
    var shuffleMode: Bool = false
    

    
    // Image Cache
    private var imageCache = NSCache<NSString, UIImage>()
    private var sleepTimer: Timer?
    private var sleepTimerEndTime: Date?

    private var playbackSpeed: Float = 1.0
    private var nowPlayingArtworkUrl: String?
    private var nowPlayingArtwork: MPMediaItemArtwork?
    private var nowPlayingArtworkRetryDate: Date?

    /// How the current item was loaded, so a failed stream can move on. Main thread only.
    private struct StreamLoad {
        let trackId: String
        let headers: [String: String]?
        let segmentBase: BilibiliPlayUrlResponse.SegmentBase?
        /// Cleared when the track starts over, so a later failure resumes where it happened.
        var startPosition: Double?
        var mirrors: [String]
        let fallback: ((Double?) -> Void)?
        /// Fetches new links for the same stream; nil when it isn't resolved from Bilibili.
        let refresh: ((Double?) -> Void)?
        let loadedAt = Date()
        /// Held here because AVAssetResourceLoader only keeps a weak reference to its delegate.
        let playlistLoader: DashAudioPlaylistLoader?
    }
    private var currentLoad: StreamLoad?
    /// One failure can arrive as both a failed status and a failure to play to the end.
    private weak var failedItem: AVPlayerItem?

    /// Bilibili's links last two hours, and mirrors expire with them, so a stream that
    /// fails after playing this long gets new links before anything else is tried.
    private static let streamRefreshAge: TimeInterval = 10 * 60

    private var transitionTask: UIBackgroundTaskIdentifier = .invalid

    /// The track the current AVPlayerItem belongs to; nil while the queue's current entry has no
    /// item of its own yet. The player's time and duration are only attributed to the entry
    /// through this. Main thread only.
    private var loadedTrackId: String?
    /// Set once the loaded track's listening record is written, so it is written only once.
    private var loadedTrackFinished = false
    /// Where the current queue entry starts while it has no ready item: a restored session
    /// before its first play, or a track whose stream is still loading.
    private var pendingStartPosition: Double?
    private var lastPositionSave = Date.distantPast
    private static let positionSaveInterval: TimeInterval = 5
    /// The sleep timer stopped playback during an interruption, so its end must not restart it.
    private var stayPausedAfterInterruption = false
    /// Whether playback is meant to be running: set by play and by track changes, cleared by
    /// pause. A stream that arrives later only starts playing if this still holds.
    private var wantsPlayback = true
    /// The stream lookup the current entry is waiting on, or nil when none is in flight. A
    /// lookup that returns after the queue has moved on no longer matches, and is dropped.
    private var pendingLookup: UUID?

    var onPlaybackStateChanged: ((PlaybackState) -> Void)?
    var onTrackStarted: ((String, TransitionReason) -> Void)?
    var onTrackFinished: ((String, Double, Double) -> Void)?
    var onPositionUpdate: ((Double, Double, Double) -> Void)?
    var onIsPlayingChanged: ((Bool) -> Void)?
    var onPlayerError: ((String) -> Void)?
    var onQueueChanged: (() -> Void)?
    var onPlaybackSpeedChanged: ((Float) -> Void)?
    
    override init() {
        self.player = AVPlayer()
        super.init()
        setupPlayerObservers()
        setupAudioSession()
        // The manager is created on a module queue, and commands enabled off the main
        // thread never reach the lock screen.
        DispatchQueue.main.async { [weak self] in
            self?.setupRemoteCommands()
        }
        restoreState()
    }
    
    private var timeObserverToken: Any?
    
    private func setupPlayerObservers() {
        // Status observer
        player.addObserver(self, forKeyPath: "timeControlStatus", options: [.new], context: nil)
        player.addObserver(self, forKeyPath: "currentItem.status", options: [.new], context: nil)
        
        // Periodic time observer
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.notifyPositionUpdate()
        }
        
        // End of track observer
        NotificationCenter.default.addObserver(self, selector: #selector(playerDidFinishPlaying), name: .AVPlayerItemDidPlayToEndTime, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(playerDidFailToPlayToEnd), name: .AVPlayerItemFailedToPlayToEndTime, object: nil)
    }
    
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == "timeControlStatus" {
            if player.timeControlStatus == .playing {
                endTransitionTask()
            }
            notifyPlaybackState()
        } else if keyPath == "currentItem.status" {
            let status = player.currentItem?.status ?? .unknown

            if status == .failed {
                DispatchQueue.main.async { [weak self] in
                    self?.handleItemFailed()
                }
            } else if status == .readyToPlay {
                // The real duration is only known once the item is ready.
                updateNowPlayingInfo()
            }
        }
    }
    
    private func handleItemFailed() {
        guard let item = player.currentItem, item.status == .failed else { return }
        handleStreamFailure(of: item, message: Self.describe(item.error))
    }

    private func handleStreamFailure(of item: AVPlayerItem, message: String) {
        // Without a loaded track the queue has moved on, and the next stream is already on its way.
        guard item === player.currentItem, item !== failedItem, loadedTrackId != nil else { return }
        failedItem = item
        beginTransitionTask()

        if var load = currentLoad {
            let position = player.currentTime().finiteSeconds
            let resumeAt = position > 0 ? position : load.startPosition

            if let refresh = load.refresh, Date().timeIntervalSince(load.loadedAt) >= Self.streamRefreshAge {
                NSLog("[OrpheusPlayer] stream failed, fetching new links: %@", message)
                refresh(resumeAt)
                return
            }

            if !load.mirrors.isEmpty {
                let next = load.mirrors.removeFirst()
                NSLog("[OrpheusPlayer] stream failed, trying the next mirror: %@", message)
                loadAvPlayerItem(trackId: load.trackId, url: next, headers: load.headers, segmentBase: load.segmentBase, startPosition: resumeAt, mirrors: load.mirrors, fallback: load.fallback, refresh: load.refresh)
                return
            }

            if let fallback = load.fallback {
                NSLog("[OrpheusPlayer] audio stream failed, falling back to MP4: %@", message)
                currentLoad = nil
                fallback(resumeAt)
                return
            }
        }

        NSLog("[OrpheusPlayer] playback failed: %@", message)
        onPlayerError?(message)
        onPlaybackStateChanged?(.idle)
        onIsPlayingChanged?(false)
        endTransitionTask()
    }

    /// JS matches English phrases to pick its message, and the system's own text is localized.
    private static func describe(_ error: Error?) -> String {
        guard let error = error else { return "unknown error" }
        var current: NSError? = error as NSError
        while let nsError = current {
            if nsError.domain == NSURLErrorDomain {
                return "Unable to connect: \(nsError.localizedDescription)"
            }
            current = nsError.userInfo[NSUnderlyingErrorKey] as? NSError
        }
        return error.localizedDescription
    }

    /// While the next stream loads nothing is playing, and iOS would suspend a background app.
    private func beginTransitionTask() {
        guard transitionTask == .invalid else { return }
        transitionTask = UIApplication.shared.beginBackgroundTask(withName: "OrpheusTrackTransition") { [weak self] in
            self?.endTransitionTask()
        }
    }

    private func endTransitionTask() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.endTransitionTask()
            }
            return
        }
        guard transitionTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(transitionTask)
        transitionTask = .invalid
    }

    /// Reports a stream whose links couldn't be fetched, and lets pressing play retry the failed item.
    private func failLoad(_ message: String) {
        // The previous track's item may still be loaded, and it must not play on under this one.
        if loadedTrackId == nil {
            player.replaceCurrentItem(with: nil)
        }
        onPlayerError?(message)
        onPlaybackStateChanged?(.idle)
        DispatchQueue.main.async { [weak self] in
            self?.failedItem = nil
        }
        endTransitionTask()
    }

    /// These notifications can arrive on any thread, and other players in the app post them too.
    @objc private func playerDidFinishPlaying(note: NSNotification) {
        guard let item = note.object as? AVPlayerItem else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, item === self.player.currentItem else { return }
            self.handleAutoAdvance()
        }
    }

    /// A failed segment request leaves the item's status as ready, so only this reports it.
    @objc private func playerDidFailToPlayToEnd(note: NSNotification) {
        guard let item = note.object as? AVPlayerItem else { return }
        let error = note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
        DispatchQueue.main.async { [weak self] in
            self?.handleStreamFailure(of: item, message: Self.describe(error))
        }
    }

    private func handleAutoAdvance() {
        // Either the queue has moved on while a stream loads, or this queue already ended.
        guard loadedTrackId != nil, !loadedTrackFinished else { return }
        beginTransitionTask()
        finishLoadedTrack(playedToEnd: true)

        if repeatMode == .track, let trackId = loadedTrackId {
            // As on Android, each natural loop counts as a new start of the same track.
            replayLoadedTrack(trackId)
            return
        }
        
        skipToNext(reason: .auto)
    }

    /// Starts the loaded track over from the top, as a new listen of it.
    private func replayLoadedTrack(_ trackId: String) {
        loadedTrackFinished = false
        // A failure from here on resumes where it happens, not where this item first started.
        currentLoad?.startPosition = nil
        pendingStartPosition = nil
        onTrackStarted?(trackId, .repeatMode)
        player.seek(to: .zero)
        if wantsPlayback {
            player.play()
        } else {
            endTransitionTask()
        }
    }

    /// Writes the listening record of the track the player holds, before anything replaces it.
    private func finishLoadedTrack(playedToEnd: Bool = false) {
        guard let trackId = loadedTrackId, !loadedTrackFinished else { return }
        loadedTrackFinished = true

        // A track that never got a duration never played, so it leaves no record.
        let duration = player.currentItem?.duration.finiteSeconds ?? 0
        guard duration > 0 else { return }
        let position = playedToEnd ? duration : player.currentTime().finiteSeconds

        if playedToEnd {
            GeneralStorage.shared.clearTrackResume(id: trackId)
        } else {
            GeneralStorage.shared.saveTrackResume(id: trackId, position: position, duration: duration)
        }
        onTrackFinished?(trackId, position, duration)
    }

    /// Whether the player's clock describes the current queue entry. It doesn't before the
    /// entry's own item is ready, or while the queue has moved on and a stream is loading.
    private var playerHoldsCurrentEntry: Bool {
        guard let trackId = loadedTrackId, trackId == queueManager.getCurrentTrack()?.id else { return false }
        return player.currentItem?.status == .readyToPlay
    }

    private func currentEntryPosition() -> Double {
        return playerHoldsCurrentEntry ? player.currentTime().finiteSeconds : pendingStartPosition ?? 0
    }

    private func currentEntryDuration() -> Double {
        if playerHoldsCurrentEntry, let duration = player.currentItem?.duration.finiteSeconds, duration > 0 {
            return duration
        }
        return queueManager.getCurrentTrack()?.duration ?? 0
    }
    
    // MARK: - Queue Management
    
    func getQueue() -> [Track] {
        return queueManager.getPlaybackQueue()
    }
    
    func getCurrentTrack() -> Track? {
        return queueManager.getCurrentTrack()
    }
    
    func getTrack(at index: Int) -> Track? {
        let queue = queueManager.getQueue()
        guard index >= 0 && index < queue.count else { return nil }
        return queue[index]
    }

    func getAdjacentTracks() -> [String: Track?] {
        let prevIdx = queueManager.getPreviousIndex(repeatMode: repeatMode)
        let nextIdx = queueManager.getNextIndex(repeatMode: repeatMode)
        let queue = queueManager.getQueue()
        return [
            "previous": prevIdx.flatMap { $0 >= 0 && $0 < queue.count ? queue[$0] : nil },
            "next": nextIdx.flatMap { $0 >= 0 && $0 < queue.count ? queue[$0] : nil },
        ]
    }
    
    func getCurrentIndex() -> Int {
        return queueManager.getCurrentIndex()
    }
    
    func setQueue(_ tracks: [Track], startIndex: Int) {
        finishLoadedTrack()
        queueManager.setQueue(tracks, startFromIndex: startIndex, inputShuffleMode: shuffleMode)
        
        let currentIndex = queueManager.getCurrentIndex()
        if currentIndex >= 0 {
             playTrack(at: currentIndex, reason: .playlistChanged)
        } else {
             stopPlayback()
             saveState()
        }
        
        onQueueChanged?()
    }
    
    private func getQueueCount() -> Int {
        return queueManager.getQueueCount()
    }
    
    func removeTrack(at position: Int) {
        guard let index = queueManager.backingIndex(forPlaybackPosition: position) else { return }
        let wasCurrent = queueManager.removeTrack(at: index)
        
        if wasCurrent {
             finishLoadedTrack()
             if queueManager.getQueueCount() == 0 {
                  stopPlayback()
             } else {
                  // Play new current or stop if none
                  if let current = queueManager.getCurrentTrack() {

                      playTrack(at: queueManager.getCurrentIndex(), reason: .playlistChanged)
                  } else {
                      stopPlayback()
                  }
             }
        }
        
        saveState()
        onQueueChanged?()
    }

    func moveTrack(fromIndex: Int, toIndex: Int) {
        guard queueManager.moveTrack(fromIndex: fromIndex, toIndex: toIndex) else { return }
        saveState()
        onQueueChanged?()
    }
    
    func clearQueue() {
        finishLoadedTrack()
        queueManager.clear()
        stopPlayback()
        updateNowPlayingInfo()
        saveState()
        onQueueChanged?()
    }

    func reverseRemainingQueue() {
        guard queueManager.reverseRemainingQueue() else { return }
        saveState()
        onQueueChanged?()
    }
    
    private func stopPlayback() {
        loadedTrackId = nil
        pendingStartPosition = nil
        pendingLookup = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
        onPlaybackStateChanged?(.idle)
        onIsPlayingChanged?(false)
        notifyPositionUpdate()
        endTransitionTask()
    }
    
    func addToNext(track: Track) {
        queueManager.insertNext(track: track)
        saveState()
        onQueueChanged?()
    }
    
    func addToEnd(tracks: [Track], startFromId: String?, clearQueue: Bool) {
        if clearQueue {
            // Logic similar to setQueue
            var startIndex = 0
            if let startId = startFromId, let index = tracks.firstIndex(where: { $0.id == startId }) {
                startIndex = index
            }
            setQueue(tracks, startIndex: startIndex)
        } else {
            // Append
            let existingCount = queueManager.getQueueCount()
            queueManager.append(tracks: tracks)
            
            // Only the tracks just added can be started from, so an older copy never matches.
            if let startId = startFromId, let offset = tracks.firstIndex(where: { $0.id == startId }) {
                playTrack(at: existingCount + offset, reason: .playlistChanged)
            }
            saveState()
            onQueueChanged?()
        }
    }
    
    func setExecuteShuffleMode(_ enabled: Bool) {
        guard shuffleMode != enabled else { return }
        shuffleMode = enabled
        queueManager.setShuffleMode(enabled)
        saveState()
        onQueueChanged?()
    }
    
    func setExecuteRepeatMode(_ mode: RepeatMode) {
        repeatMode = mode
        saveState()
    }
    
    // MARK: - Playback Control
    
    func play() {
        wantsPlayback = true
        let currentIndex = queueManager.getCurrentIndex()
        guard currentIndex >= 0 else { return }

        if pendingLookup != nil {
            // Its stream is on the way, and starts when it arrives.
            notifyPlaybackState()
            return
        }

        guard let trackId = loadedTrackId else {
            // Nothing is loaded for this entry: a restored session, or a stream that couldn't be fetched.
            playTrack(at: currentIndex, reason: .auto, startPosition: pendingStartPosition)
            return
        }

        guard let item = player.currentItem, player.status != .failed, item.status != .failed, item !== failedItem else {
            // The item can't play any further, so load it again and carry on from where it stopped.
            let position = player.currentTime().finiteSeconds
            playTrack(at: currentIndex, reason: .auto, startPosition: position > 0 ? position : pendingStartPosition)
            return
        }

        if loadedTrackFinished {
            // As on Android, playing again after the queue has ended starts its last track over.
            replayLoadedTrack(trackId)
            return
        }
        player.play()
    }

    func pause() {
        wantsPlayback = false
        player.pause()
        // The player has nothing to report while a stream is still on the way.
        if pendingLookup != nil {
            notifyPlaybackState()
        }
    }
    
    func playNext() {
        skipToNext(reason: .seek)
    }
    
    func skipToNext(reason: TransitionReason) {
        let count = queueManager.getQueueCount()
        if count == 0 { return }
        
        guard let nextIndex = queueManager.getNextIndex(repeatMode: repeatMode) else {
             // Only a track that played out ends the queue. As on Android, asking for the
             // next track on the last one changes nothing.
             guard reason == .auto else { return }
             onPlaybackStateChanged?(.ended)
             // A finished queue should start over next time, not restore to its last second.
             GeneralStorage.shared.savePosition(index: queueManager.getCurrentIndex(), positionSec: 0)
             endTransitionTask()
             return
        }
        
        playTrack(at: nextIndex, reason: reason)
    }
    
    func skipToPrevious() {
        // 跟随 Media3 逻辑（或许是行业标准？），当播放超过 3s，「上一曲」的语义变成「重新播放」
        if currentEntryPosition() > 3.0 {
            seek(to: 0)
            return
        }
        
        guard let prevIndex = queueManager.getPreviousIndex(repeatMode: repeatMode) else {
             seek(to: 0)
             return
        }
        
        playTrack(at: prevIndex, reason: .seek)
    }
    
    func seek(to seconds: Double) {
        // Without an item of its own the entry has nothing to seek, so it starts from here
        // instead: a restored session before its first play, or a stream still on the way.
        if loadedTrackId == nil, let track = queueManager.getCurrentTrack() {
            pendingStartPosition = seconds
            GeneralStorage.shared.savePosition(index: queueManager.getCurrentIndex(), positionSec: seconds)
            onPositionUpdate?(seconds, track.duration ?? 0, 0)
            updateNowPlayingInfo()
            return
        }

        // Moving back into a track that has played to its end makes this a new listen of it.
        if loadedTrackFinished, let trackId = loadedTrackId {
            loadedTrackFinished = false
            onTrackStarted?(trackId, .seek)
        }

        let time = CMTime(seconds: seconds, preferredTimescale: 1000)
        player.seek(to: time) { [weak self] _ in
            DispatchQueue.main.async {
                self?.savePositionState()
                self?.updateNowPlayingInfo()
            }
        }
    }
    
    // MARK: - Track Loading
    
    private func playTrack(at index: Int, reason: TransitionReason, startPosition: Double? = nil) {
        // Natural ends have already settled, and a retry stays on the same track. Neither of
        // them is a request to play, so a pause that came just before still holds.
        if reason != .auto {
            finishLoadedTrack()
            wantsPlayback = true
        }
        loadedTrackId = nil
        // Anything still being fetched belonged to the entry this one replaces.
        pendingLookup = nil

        // Index is BACKING index
        queueManager.skipTo(backingIndex: index)
        guard let track = queueManager.getCurrentTrack() else {
            return
        }

        let startPosition = startPosition ?? GeneralStorage.shared.trackResumePosition(id: track.id)
        pendingStartPosition = startPosition
        
        onTrackStarted?(track.id, reason)
        saveState()
        
        let urlString = track.url
        
        // Check for local download first
        if let localUrl = OrpheusDownloadManager.shared.getDownloadedFileUrl(id: track.id) {
             // Use local file
             loadAvPlayerItem(trackId: track.id, url: localUrl.absoluteString, headers: nil, startPosition: startPosition)
             return
        }
        
        if urlString.starts(with: "orpheus://bilibili") {
            // The previous track must not play on, or lend its position, under this one while the
            // stream is fetched. Nothing is audible until then, so keep the app running.
            beginTransitionTask()
            player.pause()
            player.replaceCurrentItem(with: nil)
            resolveAndPlayBilibili(url: urlString, trackId: track.id, startPosition: startPosition)
        } else {
            loadAvPlayerItem(trackId: track.id, url: urlString, headers: nil, startPosition: startPosition)
        }
    }
    
    private func resolveAndPlayBilibili(url: String, trackId: String, startPosition: Double? = nil) {
        guard let uri = URL(string: url),
              let components = URLComponents(url: uri, resolvingAgainstBaseURL: false) else {

            failLoad("Invalid Bilibili URL")
            return
        }
        
        let bvid = components.queryItems?.first(where: { $0.name == "bvid" })?.value
        let cid = components.queryItems?.first(where: { $0.name == "cid" })?.value
        
        guard let bvid = bvid else {

            failLoad("Missing bvid in URL")
            return
        }
        
        if let cid = cid {
            fetchBilibiliPlayUrl(bvid: bvid, cid: cid, trackId: trackId, startPosition: startPosition)
        } else {
            let lookup = beginLookup()
            BilibiliApi.shared.getPageList(bvid: bvid) { [weak self] result in
                DispatchQueue.main.async {
                    guard let self = self, self.pendingLookup == lookup else { return }
                    switch result {
                    case .success(let cidInt):

                        self.fetchBilibiliPlayUrl(bvid: bvid, cid: String(cidInt), trackId: trackId, startPosition: startPosition)
                    case .failure(let error):
                        self.pendingLookup = nil
                        self.failLoad(Self.describe(error))
                    }
                }
            }
        }
    }

    /// Marks a stream lookup for the current entry as in flight, replacing any earlier one.
    private func beginLookup() -> UUID {
        let lookup = UUID()
        let wasIdle = pendingLookup == nil
        pendingLookup = lookup
        if wasIdle {
            notifyPlaybackState()
        }
        return lookup
    }

    private func fetchBilibiliPlayUrl(bvid: String, cid: String, trackId: String, startPosition: Double? = nil, audioOnly: Bool = true) {
        // The spectrum tap needs a real audio track, which an HLS asset doesn't expose.
        let audioOnly = audioOnly && !GeneralStorage.shared.isSpectrumVisualizerEnabled
        let lookup = beginLookup()
        BilibiliApi.shared.getPlayStream(bvid: bvid, cid: cid, audioOnly: audioOnly) { [weak self] result in
            DispatchQueue.main.async {
                guard let self = self, self.pendingLookup == lookup else { return }
                self.pendingLookup = nil
                switch result {
                case .success(let stream):
                    guard let url = stream.urls.first else {
                        self.failLoad("AudioStreamError: no playable stream")
                        return
                    }
                    if let measured = stream.measuredLoudness, let uri = self.queueManager.getCurrentTrack()?.url {
                        GeneralStorage.shared.saveLoudness(uri: uri, measured: measured)
                    }
                    // Keep the MP4 as a last resort if the audio stream can't be played.
                    let fallback: ((Double?) -> Void)? = stream.segmentBase == nil ? nil : { [weak self] position in
                        self?.fetchBilibiliPlayUrl(bvid: bvid, cid: cid, trackId: trackId, startPosition: position, audioOnly: false)
                    }
                    let refresh: (Double?) -> Void = { [weak self] position in
                        self?.fetchBilibiliPlayUrl(bvid: bvid, cid: cid, trackId: trackId, startPosition: position, audioOnly: audioOnly)
                    }
                    // A seek made while the first stream was on the way moved where the entry starts.
                    let startPosition = self.loadedTrackId == nil ? self.pendingStartPosition : startPosition
                    self.loadAvPlayerItem(trackId: trackId, url: url, headers: BilibiliApi.browserHeaders, segmentBase: stream.segmentBase, startPosition: startPosition,
                                          mirrors: Array(stream.urls.dropFirst()), fallback: fallback, refresh: refresh)
                case .failure(let error):

                    self.failLoad(Self.describe(error))
                }
            }
        }
    }

    /// Same rule as Android: only tracks louder than Bilibili's -14 LUFS target are turned down.
    private func applyLoudness() {
        let measured = queueManager.getCurrentTrack().map { GeneralStorage.shared.measuredLoudness(uri: $0.url) } ?? 0
        guard GeneralStorage.shared.isLoudnessNormalizationEnabled, measured != 0 else {
            player.volume = 1
            return
        }
        player.volume = min(1, Float(pow(10, (-14 - measured) / 20)))
    }

    func refreshLoudness() {
        DispatchQueue.main.async { [weak self] in
            self?.applyLoudness()
        }
    }

    private func loadAvPlayerItem(trackId: String, url: String, headers: [String: String]?, segmentBase: BilibiliPlayUrlResponse.SegmentBase? = nil, startPosition: Double? = nil,
                                  mirrors: [String] = [], fallback: ((Double?) -> Void)? = nil, refresh: ((Double?) -> Void)? = nil) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.loadAvPlayerItem(trackId: trackId, url: url, headers: headers, segmentBase: segmentBase, startPosition: startPosition, mirrors: mirrors, fallback: fallback, refresh: refresh)
            }
            return
        }
        guard let nsUrl = URL(string: url) else {
            failLoad("Invalid stream URL")
            return
        }

        var options: [String: Any] = [:]
        if let headers = headers {
            options["AVURLAssetHTTPHeaderFieldsKey"] = headers
        }

        let asset: AVURLAsset
        var playlistLoader: DashAudioPlaylistLoader?
        if let segmentBase = segmentBase {
            let loader = DashAudioPlaylistLoader(mediaUrl: url, segmentBase: segmentBase, headers: headers ?? [:])
            asset = AVURLAsset(url: DashAudioPlaylistLoader.playlistUrl, options: options)
            asset.resourceLoader.setDelegate(loader, queue: loader.queue)
            playlistLoader = loader
        } else {
            asset = AVURLAsset(url: nsUrl, options: options)
        }
        currentLoad = StreamLoad(trackId: trackId, headers: headers, segmentBase: segmentBase, startPosition: startPosition, mirrors: mirrors, fallback: fallback, refresh: refresh, playlistLoader: playlistLoader)
        loadedTrackId = trackId
        loadedTrackFinished = false
        pendingStartPosition = startPosition

        let item = AVPlayerItem(asset: asset)
        if segmentBase == nil {
            attachSpectrumTap(to: item, asset: asset)
        }

        applyLoudness()
        player.replaceCurrentItem(with: item)
        if let startPos = startPosition, startPos > 0 {
             let time = CMTime(seconds: startPos, preferredTimescale: 1000)
             player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
        }
        if wantsPlayback {
            player.play()
        } else {
            // Paused while the stream was on the way. Nothing will start playing to end the task.
            endTransitionTask()
        }
    }

    /// Loading a remote asset's tracks waits on the network, so this must stay asynchronous.
    private func attachSpectrumTap(to item: AVPlayerItem, asset: AVAsset) {
        asset.loadTracks(withMediaType: .audio) { [weak item] tracks, _ in
            guard let track = tracks?.first, let tap = AudioSpectrumAnalyzer.shared.createTap() else { return }
            let inputParams = AVMutableAudioMixInputParameters(track: track)
            inputParams.audioTapProcessor = tap
            let audioMix = AVMutableAudioMix()
            audioMix.inputParameters = [inputParams]
            DispatchQueue.main.async {
                item?.audioMix = audioMix
            }
        }
    }

    // MARK: - Notification
    
    private func notifyPositionUpdate() {
        onPositionUpdate?(currentEntryPosition(), currentEntryDuration(), getBufferedPosition())
        
        // Update lock screen progress occasionally or on state change
        // MPNowPlayingInfoCenter handles 'elapsedPlaybackTime' automatically so we mainly update on rate/status changes.

        // Pauses and track changes save on their own; this covers a crash or kill mid-track.
        if player.timeControlStatus == .playing, Date().timeIntervalSince(lastPositionSave) >= Self.positionSaveInterval {
            savePositionState()
        }
    }
    
    private func notifyPlaybackState() {
        var state: PlaybackState = .idle
        switch player.timeControlStatus {
        case .paused:
            state = .ready

        case .waitingToPlayAtSpecifiedRate:
            state = .buffering

        case .playing:
            state = .ready

        @unknown default:
            state = .idle

        }

        // Nothing is loaded while a stream is on the way, but playback is about to start.
        if pendingLookup != nil && wantsPlayback {
            state = .buffering
        }
        
        onPlaybackStateChanged?(state)
        onIsPlayingChanged?(isPlaying())
        
        if state == .ready || state == .idle {
             savePositionState()
        }
        
        updateNowPlayingInfo()
    }
    
    // MARK: - System Integration
    
    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            
            // Interruption observer
            NotificationCenter.default.addObserver(self, selector: #selector(handleInterruption), name: AVAudioSession.interruptionNotification, object: session)
        } catch {

        }
    }
    
    func setAllowSimultaneousPlayback(_ enabled: Bool) throws {
        try AVAudioSession.sharedInstance().setCategory(
            .playback,
            mode: .default,
            options: enabled ? [.mixWithOthers] : []
        )
    }

    @objc private func handleInterruption(notification: Notification) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.handleInterruption(notification: notification)
            }
            return
        }
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        
        if type == .began {
            // Audio interrupted (phone call, etc.), pause player
             stayPausedAfterInterruption = false
             pause()
        } else if type == .ended {
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) && !stayPausedAfterInterruption {
                    play()
                }
            }
        }
    }
    
    private func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()
        
        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.playCommand.isEnabled = true
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.changePlaybackPositionCommand.isEnabled = true
        
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] event in
            guard let self = self else { return .commandFailed }
            if self.isPlaying() {
                self.pause()
            } else {
                self.play()
            }
            return .success
        }
        
        commandCenter.playCommand.addTarget { [weak self] event in
            self?.play()
            return .success
        }
        
        commandCenter.pauseCommand.addTarget { [weak self] event in
            self?.pause()
            return .success
        }
        
        commandCenter.nextTrackCommand.addTarget { [weak self] event in
            self?.playNext()
            return .success
        }
        
        commandCenter.previousTrackCommand.addTarget { [weak self] event in
            self?.skipToPrevious()
            return .success
        }
        
        commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            if let event = event as? MPChangePlaybackPositionCommandEvent {
                self?.seek(to: event.positionTime)
                return .success
            }
            return .commandFailed
        }
    }
    
    private func updateNowPlayingInfo() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.updateNowPlayingInfo()
            }
            return
        }

        guard let track = getCurrentTrack() else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title ?? "Unknown Title",
            MPMediaItemPropertyArtist: track.artist ?? "Unknown Artist",
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentEntryPosition(),
            MPNowPlayingInfoPropertyPlaybackRate: player.rate,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: playbackSpeed,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPNowPlayingInfoPropertyIsLiveStream: false,
            MPNowPlayingInfoPropertyPlaybackQueueIndex: queueManager.getCurrentIndex(),
            MPNowPlayingInfoPropertyPlaybackQueueCount: queueManager.getQueueCount()
        ]

        let duration = currentEntryDuration()
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }

        if let artworkUrl = track.artwork {
            let retryDue = nowPlayingArtworkRetryDate.map { $0 <= Date() } ?? false
            if artworkUrl != nowPlayingArtworkUrl || retryDue {
                loadNowPlayingArtwork(from: artworkUrl)
            } else if let artwork = nowPlayingArtwork {
                info[MPMediaItemPropertyArtwork] = artwork
            }
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadNowPlayingArtwork(from urlString: String) {
        nowPlayingArtworkUrl = urlString
        nowPlayingArtwork = nil
        nowPlayingArtworkRetryDate = nil
        guard let url = URL(string: urlString) else { return }
        downloadImage(url: url) { [weak self] image in
            guard let self, self.nowPlayingArtworkUrl == urlString else { return }
            guard let image else {
                // Waiting keeps a URL that never decodes from costing a download per update.
                self.nowPlayingArtworkRetryDate = Date().addingTimeInterval(60)
                return
            }
            self.nowPlayingArtwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            self.updateNowPlayingInfo()
        }
    }

    private func downloadImage(url: URL, completion: @escaping (UIImage?) -> Void) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            let image = data.flatMap { UIImage(data: $0) }
            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }
    
    func skipTo(index: Int) {
        guard let backingIndex = queueManager.backingIndex(forPlaybackPosition: index) else { return }
        playTrack(at: backingIndex, reason: .seek)
    }
    
    // MARK: - Playback Attributes
    
    func setPlaybackSpeed(_ speed: Float) {
        playbackSpeed = speed
        // play() starts at defaultRate, so the speed survives pauses and track changes.
        player.defaultRate = speed
        if player.rate > 0 {
            player.rate = speed
        }
        onPlaybackSpeedChanged?(speed)
        updateNowPlayingInfo()
    }
    
    func getPlaybackSpeed() -> Float {
        return playbackSpeed
    }
    
    // MARK: - Getters
    
    func getPosition() -> Double {
        return currentEntryPosition()
    }
    
    func getBufferedPosition() -> Double {
        return player.currentItem?.loadedTimeRanges.last?.timeRangeValue.end.finiteSeconds ?? 0.0
    }
    
    func getDuration() -> Double {
        return currentEntryDuration()
    }
    
    func isPlaying() -> Bool {
        return player.rate > 0 && player.error == nil
    }
    
    // MARK: - Sleep Timer
    
    func setSleepTimer(durationMs: Double) {
        cancelSleepTimer()
        guard durationMs > 0 else { return }
        
        let interval = durationMs / 1000.0
        sleepTimerEndTime = Date().addingTimeInterval(interval)
        
        sleepTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
            self?.stayPausedAfterInterruption = true
            self?.pause()
            self?.cancelSleepTimer()
        }
    }
    
    func cancelSleepTimer() {
        sleepTimer?.invalidate()
        sleepTimer = nil
        sleepTimerEndTime = nil
    }
    
    func getSleepTimerEndTime() -> Double? {
        guard let endTime = sleepTimerEndTime, endTime > Date() else { return nil }
        return endTime.timeIntervalSince1970 * 1000.0
    }
    
    // MARK: - Persistence
    
    private func saveState() {
        GeneralStorage.shared.saveQueue(queueManager.getQueue())
        
        GeneralStorage.shared.savePosition(
            index: queueManager.getCurrentIndex(),
            positionSec: currentEntryPosition()
        )
        
        GeneralStorage.shared.saveRepeatMode(repeatMode.rawValue)
        GeneralStorage.shared.saveShuffleMode(shuffleMode)
    }
    
    private func savePositionState() {
        guard playerHoldsCurrentEntry, !loadedTrackFinished, let trackId = loadedTrackId else { return }
        lastPositionSave = Date()
        let seconds = player.currentTime().finiteSeconds
        GeneralStorage.shared.savePosition(index: queueManager.getCurrentIndex(), positionSec: seconds)
        GeneralStorage.shared.saveTrackResume(id: trackId, position: seconds, duration: currentEntryDuration())
    }

    private func restoreState() {
        // Restore Modes
        if let mode = RepeatMode(rawValue: GeneralStorage.shared.getSavedRepeatMode()) {
            repeatMode = mode
        }
        shuffleMode = GeneralStorage.shared.getSavedShuffleMode()
        
        // Restore Queue
        let restoredQueue = GeneralStorage.shared.getSavedQueue()
        
        // Restore Index
        let savedIndex = GeneralStorage.shared.getSavedIndex()
        var savedPosition = 0.0
        if GeneralStorage.shared.isRestoreEnabled {
            savedPosition = GeneralStorage.shared.getSavedPosition()
        }
        
        if !restoredQueue.isEmpty {
             // Initialize queue manager
             queueManager.setQueue(restoredQueue, startFromIndex: savedIndex, inputShuffleMode: shuffleMode)
             
             // Now handle playback state restoration
             if savedIndex >= 0 && savedIndex < restoredQueue.count {
                 if GeneralStorage.shared.isAutoplayOnStartEnabled {
                     playTrack(at: savedIndex, reason: .playlistChanged, startPosition: savedPosition > 0 ? savedPosition : nil)
                 } else if let track = queueManager.getCurrentTrack() {
                     // No item exists until the first play, so the position waits for it. JS has
                     // no listeners this early and reads the restored state through the getters.
                     pendingStartPosition = savedPosition > 0 ? savedPosition : GeneralStorage.shared.trackResumePosition(id: track.id)
                 }
             }
        }
    }
}

private extension CMTime {
    /// Unknown times come back as NaN or infinity, which neither JS nor storage can use.
    var finiteSeconds: Double {
        let value = seconds
        return value.isFinite && value > 0 ? value : 0
    }
}
