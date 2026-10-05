import AVFoundation
import ExpoModulesCore
import MediaPlayer

class OrpheusPlayerManager: NSObject {
    static let shared = OrpheusPlayerManager()
    
    private let player: AVPlayer
    private let queueManager = OrpheusQueueManager()
    private let playbackHistory = PlaybackHistoryTracker()
    private var loadedTrackId: String?
    private var pendingStartPosition: Double?
    private var loadGeneration = 0
    private var seekGeneration = 0
    private var isSeeking = false
    private var wantsToPlay = false
    private var playbackRate: Float = 1
    private var abLoopObserverToken: Any?
    private var abLoopObserverGeneration = 0
    private var abLoopPreviewTrackId: String?
    private var abLoopPreview: (trackId: String, startSec: Double, endSec: Double)?

    
    var repeatMode: RepeatMode = .off
    var shuffleMode: Bool = false
    

    
    // Image Cache
    private var imageCache = NSCache<NSString, UIImage>()
    private var sleepTimer: Timer?
    private var sleepTimerEndTime: Date?
    

    

    var onPlaybackStateChanged: ((PlaybackState) -> Void)?
    var onTrackStarted: ((String, TransitionReason) -> Void)?
    var onTrackFinished: ((String, Double, Double, PlaybackHistoryTracker.Summary?) -> Void)?
    var onPositionUpdate: ((Double, Double, Double) -> Void)?
    var onIsPlayingChanged: ((Bool) -> Void)?
    var onPlayerError: ((String) -> Void)?
    var onQueueChanged: (() -> Void)?
    
    override init() {
        self.player = AVPlayer()
        super.init()
        setupPlayerObservers()
        setupAudioSession()
        setupRemoteCommands()
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
    }
    
    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [weak self] in self?.handlePlayerObservation(keyPath) }
            return
        }
        handlePlayerObservation(keyPath)
    }

    private func handlePlayerObservation(_ keyPath: String?) {
        if keyPath == "timeControlStatus" {
            samplePlaybackHistory()
            notifyPlaybackState()
        } else if keyPath == "currentItem.status" {
            let status = player.currentItem?.status ?? .unknown

            if status == .readyToPlay { refreshAbLoopObserver() }
            if status == .failed {
                let errorMsg = player.currentItem?.error?.localizedDescription ?? "unknown error"

                onPlayerError?(errorMsg)
                onPlaybackStateChanged?(.idle)
                onIsPlayingChanged?(false)
            }
        }
    }
    
    @objc private func playerDidFinishPlaying(note: NSNotification) {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [weak self] in self?.playerDidFinishPlaying(note: note) }
            return
        }
        guard let item = note.object as? AVPlayerItem, item === player.currentItem, !isSeeking else { return }
        let duration = getDuration()
        // 边界 seek 已完成时，忽略同一个 item 迟到的曲尾通知。
        if duration.isFinite && duration > 0 && getPosition() + 0.01 < duration { return }
        handleAutoAdvance()
    }
    
    private func handleAutoAdvance() {
        if getAbLoop() != nil {
            jumpToAbLoopStart()
            return
        }
        finishCurrentPlayback()
        if repeatMode == .track {
            if let track = queueManager.getCurrentTrack() {
                playbackHistory.begin(id: track.id, position: 0)
            }
            seek(to: 0)
            play()
            return
        }
        skipToNext(reason: .auto)
    }

    private func samplePlaybackHistory() {
        guard !isSeeking, loadedTrackId == playbackHistory.trackId else { return }
        playbackHistory.sample(position: player.currentTime().seconds,
            isPlaying: player.timeControlStatus == .playing, duration: getDuration())
    }

    private func finishCurrentPlayback() {
        guard let trackId = playbackHistory.trackId else { return }
        samplePlaybackHistory()
        let summary = playbackHistory.finish()
        onTrackFinished?(trackId, getPosition(), getDuration(), summary)
    }

    // MARK: - Queue Management
    
    func getQueue() -> [Track] {
        return queueManager.getQueue()
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
        queueManager.setQueue(tracks, startFromIndex: startIndex, inputShuffleMode: shuffleMode)
        
        let currentIndex = queueManager.getCurrentIndex()
        if currentIndex >= 0 {
             playTrack(at: currentIndex, reason: .playlistChanged)
        }
        
        saveState()
    }
    
    private func getQueueCount() -> Int {
        return queueManager.getQueueCount()
    }
    
    func removeTrack(at index: Int) {
        // index is backing index
        let wasCurrent = queueManager.removeTrack(at: index)
        
        if wasCurrent {
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
        queueManager.clear()
        stopPlayback()
        updateNowPlayingInfo()
        saveState()
    }

    func reverseRemainingQueue() {
        guard queueManager.reverseRemainingQueue() else { return }
        saveState()
        onQueueChanged?()
    }
    
    private func stopPlayback() {
        finishCurrentPlayback()
        loadGeneration += 1
        wantsToPlay = false
        loadedTrackId = nil
        removeAbLoopObserver()
        GeneralStorage.shared.clearAbLoop()
        abLoopPreviewTrackId = nil
        abLoopPreview = nil
        player.pause()
        player.replaceCurrentItem(with: nil)
        onPlaybackStateChanged?(.idle)
        onIsPlayingChanged?(false)
        notifyPositionUpdate()
    }
    
    func addToNext(track: Track) {
        queueManager.insertNext(track: track)
        saveState()
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
            queueManager.append(tracks: tracks)
            
            if let startId = startFromId, let index = queueManager.getQueue().firstIndex(where: { $0.id == startId }) {
                // If startFromId is present, play the specified track
                playTrack(at: index, reason: .playlistChanged)
            }
            saveState()
        }
    }
    
    func setExecuteShuffleMode(_ enabled: Bool) {
        guard shuffleMode != enabled else { return }
        shuffleMode = enabled
        queueManager.setShuffleMode(enabled)
        saveState()
    }
    
    func setExecuteRepeatMode(_ mode: RepeatMode) {
        repeatMode = mode
        saveState()
    }
    
    // MARK: - Playback Control
    
    func play() {
        wantsToPlay = true
        let currentIndex = queueManager.getCurrentIndex()
        if player.currentItem == nil && currentIndex >= 0 {

             playTrack(at: currentIndex, reason: .auto, startPosition: pendingStartPosition, preserveHistory: true)
             return
        }
        if player.status == .failed || player.currentItem?.status == .failed {

             playTrack(at: currentIndex, reason: .auto, startPosition: getPosition(), preserveHistory: true)
             return
        }
        if let loop = getAbLoop(), getPosition() >= loop.endSec {
            jumpToAbLoopStart()
        } else { player.rate = playbackRate }
    }
    
    func pause() {
        samplePlaybackHistory()
        wantsToPlay = false
        player.pause()
    }
    
    func playNext() {
        skipToNext(reason: .seek)
    }
    
    func skipToNext(reason: TransitionReason) {
        let count = queueManager.getQueueCount()
        if count == 0 { return }
        
        guard let nextIndex = queueManager.getNextIndex(repeatMode: repeatMode) else {
             // End of queue
             onPlaybackStateChanged?(.ended)
             return
        }
        
        playTrack(at: nextIndex, reason: reason)
    }
    
    func skipToPrevious() {
        // 跟随 Media3 逻辑（或许是行业标准？），当播放超过 3s，「上一曲」的语义变成「重新播放」
        if player.currentTime().seconds > 3.0 {
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
        guard seconds.isFinite, seconds >= 0 else { return }
        performSeek(to: seconds)
    }

    private func performSeek(to seconds: Double) {
        samplePlaybackHistory()
        let generation = loadGeneration
        seekGeneration += 1
        let seekRequest = seekGeneration
        let item = player.currentItem
        playbackHistory.jump(oldPosition: getPosition(), newPosition: seconds,
            isPlaying: false, duration: getDuration())
        isSeeking = true
        player.seek(to: CMTime(seconds: seconds, preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
            DispatchQueue.main.async {
                guard let self = self, self.loadGeneration == generation, self.seekGeneration == seekRequest,
                    self.player.currentItem === item else { return }
                self.isSeeking = false
                // 实际落点重新设基线；加载、seek 等待时间不计入播放。
                self.playbackHistory.jump(oldPosition: self.getPosition(), newPosition: self.getPosition(),
                    isPlaying: self.player.timeControlStatus == .playing, duration: self.getDuration())
                if finished && self.wantsToPlay {
                    if let loop = self.getAbLoop(), self.getPosition() >= loop.endSec {
                        self.jumpToAbLoopStart()
                    } else { self.player.rate = self.playbackRate }
                }
            }
        }
    }

    // MARK: - Track Loading
    
    private func playTrack(at index: Int, reason: TransitionReason, startPosition: Double? = nil, preserveHistory: Bool = false) {
        let preserving = preserveHistory && playbackHistory.trackId == queueManager.getCurrentTrack()?.id
        if !preserving { finishCurrentPlayback() }
        else { samplePlaybackHistory() }
        pendingStartPosition = nil
        loadGeneration += 1
        let generation = loadGeneration
        isSeeking = false
        loadedTrackId = nil
        removeAbLoopObserver()
        // 新曲目异步解析期间不能继续播放旧 item，也不能把旧位置上报给新曲目。
        player.pause()
        player.replaceCurrentItem(with: nil)

        // Index is BACKING index
        queueManager.skipTo(backingIndex: index)
        guard let track = queueManager.getCurrentTrack() else {
            return
        }

        if !preserving { playbackHistory.begin(id: track.id, position: startPosition ?? 0) }
        if abLoopPreviewTrackId != track.id {
            abLoopPreviewTrackId = nil
            abLoopPreview = nil
        }
        wantsToPlay = true
        // 比较持久化设置，不能在播放器尚未加载时查询活动循环。
        if let loop = GeneralStorage.shared.getAbLoop(), loop.trackId != track.id {
            GeneralStorage.shared.clearAbLoop()
        }
        
        if let loop = getAbLoop(), loop.trackId == track.id {
            playbackHistory.setLoop(start: loop.startSec, end: loop.endSec)
        }
        // Optimistic update

        
        onTrackStarted?(track.id, reason)
        saveState()
        
        let urlString = track.url
        
        // Check for local download first
        if let localUrl = OrpheusDownloadManager.shared.getDownloadedFileUrl(id: track.id) {
             // Use local file
             loadAvPlayerItem(url: localUrl.absoluteString, headers: nil, startPosition: startPosition, generation: generation)
             return
        }
        
        if urlString.starts(with: "orpheus://bilibili") {
            resolveAndPlayBilibili(url: urlString, startPosition: startPosition, generation: generation)
        } else {
            loadAvPlayerItem(url: urlString, headers: nil, startPosition: startPosition, generation: generation)
        }
    }
    
    private func resolveAndPlayBilibili(url: String, startPosition: Double? = nil, generation: Int) {
        guard let uri = URL(string: url),
              let components = URLComponents(url: uri, resolvingAgainstBaseURL: false) else {

            onPlayerError?("Invalid Bilibili URL")
            onPlaybackStateChanged?(.idle)
            return
        }
        
        let bvid = components.queryItems?.first(where: { $0.name == "bvid" })?.value
        let cid = components.queryItems?.first(where: { $0.name == "cid" })?.value
        
        guard let bvid = bvid else {

            onPlayerError?("Missing bvid in URL")
            onPlaybackStateChanged?(.idle)
            return
        }
        
        if let cid = cid {
            fetchBilibiliPlayUrl(bvid: bvid, cid: cid, startPosition: startPosition, generation: generation)
        } else {

            BilibiliApi.shared.getPageList(bvid: bvid) { [weak self] result in
                DispatchQueue.main.async {
                    guard self?.loadGeneration == generation else { return }
                    switch result {
                    case .success(let cidInt):

                        self?.fetchBilibiliPlayUrl(bvid: bvid, cid: String(cidInt), startPosition: startPosition, generation: generation)
                    case .failure(let error):

                        self?.onPlayerError?(error.localizedDescription)
                        self?.onPlaybackStateChanged?(.idle)
                    }
                }
            }
        }
    }
    
    private func fetchBilibiliPlayUrl(bvid: String, cid: String, startPosition: Double? = nil, generation: Int) {

        
        BilibiliApi.shared.getPlayUrl(bvid: bvid, cid: cid) { [weak self] result in
            DispatchQueue.main.async {
                guard self?.loadGeneration == generation else { return }
                switch result {
                case .success(let realUrl):

                    // Bilibili requires Referer header
                    let headers: [String: String] = [
                        "Referer": "https://www.bilibili.com/",
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ]
                    self?.loadAvPlayerItem(url: realUrl, headers: headers, startPosition: startPosition, generation: generation)
                case .failure(let error):

                    self?.onPlayerError?(error.localizedDescription)
                    // Reset state so UI doesn't stick in loading
                    self?.onPlaybackStateChanged?(.idle)
                }
            }
        }
    }
    
    private func loadAvPlayerItem(url: String, headers: [String: String]?, startPosition: Double? = nil, generation: Int) {
        guard generation == loadGeneration, let nsUrl = URL(string: url) else {

            return
        }
        

        
        let asset: AVURLAsset
        if let headers = headers {
            let options = ["AVURLAssetHTTPHeaderFieldsKey": headers]
            asset = AVURLAsset(url: nsUrl, options: options)
        } else {
            asset = AVURLAsset(url: nsUrl)
        }
        
        let item = AVPlayerItem(asset: asset)
        
        // Attach Spectrum Tap
        if let tap = AudioSpectrumAnalyzer.shared.createTap() {
            let audioMix = AVMutableAudioMix()
            // Try to find audio track. Note: This assumes tracks are available synchronously or shortly. 
            // For robust implementation with remote assets, we might need to wait for "tracks" key.
            // But doing it synchronously here is the "simple" approach.
            if let track = asset.tracks(withMediaType: .audio).first {
                let inputParams = AVMutableAudioMixInputParameters(track: track)
                inputParams.audioTapProcessor = tap
                audioMix.inputParameters = [inputParams]
                item.audioMix = audioMix
            }
        }

        loadedTrackId = queueManager.getCurrentTrack()?.id
        player.replaceCurrentItem(with: item)
        playbackHistory.jump(oldPosition: startPosition ?? 0, newPosition: startPosition ?? 0,
            isPlaying: false, duration: getDuration())
        refreshAbLoopObserver()
        if let startPos = startPosition, startPos > 0 { performSeek(to: startPos) }
        if wantsToPlay { player.rate = playbackRate }
    }

    // MARK: - Notification
    
    private func notifyPositionUpdate() {
        let currentTime = player.currentTime().seconds
        let duration = player.currentItem?.duration.seconds ?? 0
        let buffered = player.currentItem?.loadedTimeRanges.last?.timeRangeValue.end.seconds ?? 0

        samplePlaybackHistory()

        onPositionUpdate?(currentTime, duration, buffered)
        
        // Update lock screen progress occasionally or on state change
        // MPNowPlayingInfoCenter handles 'elapsedPlaybackTime' automatically so we mainly update on rate/status changes.
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
    
    @objc private func handleInterruption(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        
        if type == .began {
            // Audio interrupted (phone call, etc.), pause player

             pause()
        } else if type == .ended {
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
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
        guard let track = getCurrentTrack() else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        
        // Ensure audio session is active for lock screen controls to appear
        
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title ?? "Unknown Title",
            MPMediaItemPropertyArtist: track.artist ?? "Unknown Artist",
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime().seconds,
            MPNowPlayingInfoPropertyPlaybackRate: player.rate,
            MPNowPlayingInfoPropertyPlaybackQueueIndex: queueManager.getCurrentIndex(),
            MPNowPlayingInfoPropertyPlaybackQueueCount: queueManager.getQueueCount()
        ]
        
        if let duration = track.duration {
             info[MPMediaItemPropertyPlaybackDuration] = duration
        } else if let playerDuration = player.currentItem?.duration.seconds, !playerDuration.isNaN {
             info[MPMediaItemPropertyPlaybackDuration] = playerDuration
        }
        
        // Artwork
        if let artworkUrlStr = track.artwork, let artworkUrl = URL(string: artworkUrlStr) {
            downloadImage(url: artworkUrl) { image in
                guard let image = image else { return }
                
                // Verify track hasn't changed before updating artwork
                if var currentInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo {
                    if currentInfo[MPMediaItemPropertyTitle] as? String == track.title {
                         let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                         currentInfo[MPMediaItemPropertyArtwork] = artwork
                         MPNowPlayingInfoCenter.default().nowPlayingInfo = currentInfo
                    }
                } else {
                    // If info was cleared but we just got image, maybe we should set it again?
                    // Safe to just update info variable and set it?
                    // We need to carry over the other fields.
                    info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                }
            }
        }
        
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
    

    private func downloadImage(url: URL, completion: @escaping (UIImage?) -> Void) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let image = UIImage(data: data) else {
                completion(nil)
                return
            }
            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }
    
    func skipTo(index: Int) {
        // index is backing index from UI
        playTrack(at: index, reason: .seek)
    }
    
    // MARK: - Playback Attributes
    
    func setPlaybackSpeed(_ speed: Float) {
        guard speed.isFinite, speed > 0 else { return }
        samplePlaybackHistory()
        playbackRate = speed
        if wantsToPlay { player.rate = speed }
    }
    
    func getPlaybackSpeed() -> Float {
        return playbackRate
    }
    
    // MARK: - Getters
    
    func getPosition() -> Double {
        return player.currentTime().seconds
    }
    
    func getBufferedPosition() -> Double {
        return player.currentItem?.loadedTimeRanges.last?.timeRangeValue.end.seconds ?? 0.0
    }
    
    func getDuration() -> Double {
        return player.currentItem?.duration.seconds ?? 0.0
    }
    
    func isPlaying() -> Bool {
        return player.rate > 0 && player.error == nil
    }
    
    // MARK: - AB Loop

    func setAbLoop(trackId: String, startSec: Double, endSec: Double) -> Bool {
        guard queueManager.getCurrentTrack()?.id == trackId, startSec.isFinite, endSec.isFinite,
            startSec >= 0, endSec > startSec else { return false }
        let duration = loadedTrackId == trackId ? getDuration() : (queueManager.getCurrentTrack()?.duration ?? 0)
        if duration.isFinite && duration > 0 && endSec > duration { return false }
        samplePlaybackHistory()
        abLoopPreviewTrackId = nil
        abLoopPreview = nil
        GeneralStorage.shared.saveAbLoop(trackId: trackId, startSec: startSec, endSec: endSec)
        playbackHistory.setLoop(start: startSec, end: endSec)
        refreshAbLoopObserver()
        return true
    }

    func clearAbLoop(trackId: String) -> Bool {
        guard queueManager.getCurrentTrack()?.id == trackId else { return false }
        samplePlaybackHistory()
        abLoopPreviewTrackId = nil
        abLoopPreview = nil
        GeneralStorage.shared.clearAbLoop()
        playbackHistory.setLoop(start: nil, end: nil)
        removeAbLoopObserver()
        return true
    }

    func getAbLoop() -> (trackId: String, startSec: Double, endSec: Double)? {
        if abLoopPreviewTrackId == queueManager.getCurrentTrack()?.id, abLoopPreviewTrackId != nil {
            return abLoopPreview
        }
        guard let loop = GeneralStorage.shared.getAbLoop(), queueManager.getCurrentTrack()?.id == loop.trackId else { return nil }
        return loop
    }

    func setAbLoopPreview(trackId: String, range: AbLoopRange?) -> Bool {
        guard queueManager.getCurrentTrack()?.id == trackId else { return false }
        if let range = range {
            let duration = loadedTrackId == trackId ? getDuration() : (queueManager.getCurrentTrack()?.duration ?? 0)
            guard range.start.isFinite, range.end.isFinite, range.start >= 0, range.end > range.start,
                !(duration.isFinite && duration > 0 && range.end > duration) else { return false }
        }
        samplePlaybackHistory()
        abLoopPreviewTrackId = trackId
        abLoopPreview = range.map { (trackId: trackId, startSec: $0.start, endSec: $0.end) }
        playbackHistory.setLoop(start: range?.start, end: range?.end)
        refreshAbLoopObserver()
        return true
    }

    func clearAbLoopPreview(trackId: String) -> Bool {
        guard queueManager.getCurrentTrack()?.id == trackId, abLoopPreviewTrackId == trackId else { return false }
        samplePlaybackHistory()
        abLoopPreviewTrackId = nil
        abLoopPreview = nil
        let loop = getAbLoop()
        playbackHistory.setLoop(start: loop?.startSec, end: loop?.endSec)
        refreshAbLoopObserver()
        return true
    }

    private func removeAbLoopObserver() {
        abLoopObserverGeneration += 1
        if let token = abLoopObserverToken { player.removeTimeObserver(token) }
        abLoopObserverToken = nil
    }

    private func refreshAbLoopObserver() {
        removeAbLoopObserver()
        guard let loop = getAbLoop(), loadedTrackId == loop.trackId else { return }
        let duration = getDuration()
        if duration.isFinite && duration > 0 && loop.endSec > duration {
            if abLoopPreviewTrackId == loop.trackId { _ = setAbLoopPreview(trackId: loop.trackId, range: nil) }
            else { _ = clearAbLoop(trackId: loop.trackId) }
            return
        }
        let generation = loadGeneration
        let observerGeneration = abLoopObserverGeneration
        abLoopObserverToken = player.addBoundaryTimeObserver(
            forTimes: [NSValue(time: CMTime(seconds: loop.endSec, preferredTimescale: 1000))], queue: .main
        ) { [weak self] in
            guard let self = self, self.loadGeneration == generation,
                self.abLoopObserverGeneration == observerGeneration, self.wantsToPlay else { return }
            self.jumpToAbLoopStart()
        }
        if wantsToPlay && player.currentTime().seconds >= loop.endSec { jumpToAbLoopStart() }
    }

    private func jumpToAbLoopStart() {
        guard !isSeeking, wantsToPlay, let loop = getAbLoop(), loadedTrackId == loop.trackId else { return }
        performSeek(to: loop.startSec)
    }

    deinit {
        removeAbLoopObserver()
        if let token = timeObserverToken { player.removeTimeObserver(token) }
        player.removeObserver(self, forKeyPath: "timeControlStatus")
        player.removeObserver(self, forKeyPath: "currentItem.status")
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Sleep Timer
    
    func setSleepTimer(durationMs: Double) {
        cancelSleepTimer()
        
        let interval = durationMs / 1000.0
        sleepTimerEndTime = Date().addingTimeInterval(interval)
        
        sleepTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
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
        guard let endTime = sleepTimerEndTime else { return nil }
        return endTime.timeIntervalSince1970 * 1000.0
    }
    
    // MARK: - Persistence
    
    private func saveState() {
        GeneralStorage.shared.saveQueue(queueManager.getQueue())
        
        GeneralStorage.shared.savePosition(
            index: queueManager.getCurrentIndex(),
            positionSec: player.currentTime().seconds
        )
        
        GeneralStorage.shared.saveRepeatMode(repeatMode.rawValue)
        GeneralStorage.shared.saveShuffleMode(shuffleMode)
    }
    
    private func savePositionState() {
        let seconds = player.currentTime().seconds
        GeneralStorage.shared.savePosition(index: queueManager.getCurrentIndex(), positionSec: seconds)
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
                 } else {
                     // Prepare but paused
                     if let track = queueManager.getCurrentTrack() {
                         playbackHistory.begin(id: track.id, position: savedPosition)
                         pendingStartPosition = savedPosition
                         if let loop = GeneralStorage.shared.getAbLoop() {
                             if loop.trackId == track.id { playbackHistory.setLoop(start: loop.startSec, end: loop.endSec) }
                             else { GeneralStorage.shared.clearAbLoop() }
                         }
                         onTrackStarted?(track.id, .playlistChanged)
                         // Emit position update so UI is consistent
                         onPositionUpdate?(savedPosition, track.duration ?? 0, 0)
                         // Preparing UI state without creating AVPlayerItem yet
                     }
                 }
             }
        }
    }
}
