import Foundation
import AVFoundation
import MediaPlayer
import Accelerate
import Observation
import AudioRealtime

@MainActor
@Observable public final class NativePlaybackEngine: PlaybackEngine {
    public private(set) var snapshot = PlaybackSnapshot()
    public private(set) var isPlaying = false
    public private(set) var isLoading = false
    public private(set) var position: Double = 0
    public private(set) var duration: Double = 0
    public private(set) var chapters: [Chapter] = []
    public private(set) var errorMessage: String?
    public private(set) var spectrum: [Float] = Array(repeating: 0, count: 48)
    public private(set) var lyrics = LyricDocument()
    public private(set) var sleepEnd: Date?
    public var preferences = PlayerPreferences() { didSet { applyPreferences() } }
    public var visualizerVisible = false { didSet { updateSpectrumDemand() } }
    public var onTrackChanged: ((Track) -> Void)?
    public var onError: ((Error) -> Void)?
    public var currentTrack: Track? { snapshot.queue.indices.contains(snapshot.index) ? snapshot.queue[snapshot.index] : nil }
    public var isPlaybackRequested: Bool { wantsPlayback }
    public var diagnostics: [String: String] {
        ["timeControl": String(player.timeControlStatus.rawValue), "rate": String(player.rate), "waiting": player.reasonForWaitingToPlay?.rawValue ?? "", "itemStatus": String(player.currentItem?.status.rawValue ?? -1), "requested": String(wantsPlayback), "repeat": snapshot.repeatMode.rawValue]
    }
    public var capturedFrames: UInt64 { bb_pcm_frames(pcm) }

    @ObservationIgnored private let player = AVPlayer()
    @ObservationIgnored private let provider: any MediaSourceProvider
    @ObservationIgnored private let database: LibraryDatabase
    @ObservationIgnored private let cache: AudioCache
    @ObservationIgnored private var playbackActivity: NSObjectProtocol?
    @ObservationIgnored private var visualizationTrack: AVAssetTrack?
    @ObservationIgnored private var resourceLoader: AudioResourceLoader?
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var observation: NSKeyValueObservation?
    @ObservationIgnored private var statusObservation: NSKeyValueObservation?
    @ObservationIgnored private var timeToken: Any?
    @ObservationIgnored private var progressInterval = -1.0
    @ObservationIgnored private var endToken: NSObjectProtocol?
    @ObservationIgnored private var failureToken: NSObjectProtocol?
    @ObservationIgnored private var generation = UUID()
    @ObservationIgnored private var loadedTrackID: String?
    @ObservationIgnored private var normalizationGain: Float = 1
    @ObservationIgnored private var consecutiveFailures = 0
    @ObservationIgnored private var shuffleRemaining: [String] = []
    @ObservationIgnored private var shuffleCycleStarted = false
    @ObservationIgnored private var historyID = UUID().uuidString
    @ObservationIgnored private var historyStart = Date()
    @ObservationIgnored private var accumulator = ListeningAccumulator()
    @ObservationIgnored private var coveredMedia = 0.0
    @ObservationIgnored private var previousPosition: Double?
    @ObservationIgnored private var lastCheckpoint = 0.0
    private var wantsPlayback = false
    @ObservationIgnored private var refreshedSource = false
    @ObservationIgnored private var previewLyrics: LyricDocument?
    @ObservationIgnored private var previewSnapshot: (PlaybackSnapshot, Bool)?
    @ObservationIgnored private let pcm: OpaquePointer
    @ObservationIgnored private var spectrumTimer: Timer?
    @ObservationIgnored private var sleepTimer: Timer?
    @ObservationIgnored private var fftReal = [Float](repeating: 0, count: 1024)
    @ObservationIgnored private var fftImag = [Float](repeating: 0, count: 1024)
    @ObservationIgnored private var fftOutReal = [Float](repeating: 0, count: 1024)
    @ObservationIgnored private var fftOutImag = [Float](repeating: 0, count: 1024)
    @ObservationIgnored private var fftWindow = [Float](repeating: 0, count: 1024)
    @ObservationIgnored private var fft: vDSP_DFT_Setup?

    public init(provider: any MediaSourceProvider, database: LibraryDatabase, cache: AudioCache, restore: Bool = true) {
        self.provider = provider; self.database = database; self.cache = cache
        pcm = bb_pcm_create()!
        fft = vDSP_DFT_zop_CreateSetup(nil, 1024, .FORWARD)
        vDSP_hann_window(&fftWindow, 1024, Int32(vDSP_HANN_NORM))
        if restore {
            snapshot = (try? database.state(PlaybackSnapshot.self, key: "playback")) ?? PlaybackSnapshot()
            preferences = (try? database.state(PlayerPreferences.self, key: "preferences")) ?? PlayerPreferences()
            position = snapshot.position; duration = currentTrack?.duration ?? 0
        }
        observation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in
                guard let self else { return }
                if self.isPlaying { self.captureAudibleTail() }
                self.isPlaying = self.player.timeControlStatus == .playing
                if self.isPlaying { self.previousPosition = self.player.currentTime().seconds }
                _ = self.accumulator.update(clock: ProcessInfo.processInfo.systemUptime, audible: self.isPlaying)
                if !self.isPlaying { self.previousPosition = nil }
                self.updateSpectrumDemand(); self.updateNowPlaying()
            }
        }
        endToken = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main) { [weak self] note in
            Task { @MainActor in
                guard let self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
                if self.isPlaying { self.captureAudibleTail() }
                self.finishHistory(completed: self.coveredMedia >= self.duration * 0.9)
                if self.previewSnapshot != nil { self.endPreview(); return }
                if self.snapshot.repeatMode == .track {
                    self.resetListeningSession(); self.seek(to: 0); self.play()
                } else { self.next(automatic: true) }
            }
        }
        failureToken = NotificationCenter.default.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: nil, queue: .main) { [weak self] note in
            Task { @MainActor in
                guard let self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
                if !self.refreshedSource { self.load(index: self.snapshot.index, position: self.position, refresh: true, autoplay: self.wantsPlayback) }
                else { self.handleFailure(item.error ?? APIError.network("playback")) }
            }
        }
        configureRemoteCommands()
        applyPreferences()
        if preferences.autoplay, currentTrack != nil { play() }
    }
    deinit {
        if let timeToken { player.removeTimeObserver(timeToken) }
        for token in [endToken, failureToken].compactMap({ $0 }) { NotificationCenter.default.removeObserver(token) }
        spectrumTimer?.invalidate(); sleepTimer?.invalidate()
        if let fft { vDSP_DFT_DestroySetup(fft) }
        bb_pcm_destroy(pcm)
        if let playbackActivity { ProcessInfo.processInfo.endActivity(playbackActivity) }
    }
    public func setQueue(_ tracks: [Track], index: Int = 0) {
        finishHistory(completed: false)
        previewSnapshot = nil; previewLyrics = nil
        snapshot.queue = tracks
        shuffleRemaining = []; shuffleCycleStarted = false
        load(index: index)
    }
    public func play() {
        guard currentTrack != nil else { return }
        wantsPlayback = true
        if player.currentItem?.status == .failed { load(index: snapshot.index, position: position, refresh: true); return }
        if loadedTrackID != currentTrack?.id { load(index: snapshot.index, position: snapshot.position); return }
        if duration > 0, position >= duration - 0.25 { resetListeningSession(); seek(to: 0) }
        player.playImmediately(atRate: Float(snapshot.rate))
    }
    public func pause() { wantsPlayback = false; if isPlaying { captureAudibleTail() }; player.pause(); isPlaying = false; updateSpectrumDemand(); updateNowPlaying(); _ = accumulator.update(clock: ProcessInfo.processInfo.systemUptime, audible: false); previousPosition = nil; saveCheckpoint() }
    public func toggle() { wantsPlayback ? pause() : play() }
    public func seek(to seconds: Double) {
        guard seconds.isFinite else { return }
        let target = max(0, min(seconds, duration > 0 ? duration : seconds))
        previousPosition = nil
        _ = accumulator.update(clock: ProcessInfo.processInfo.systemUptime, audible: false)
        player.seek(to: CMTime(seconds: target, preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero)
        position = target; snapshot.position = target; saveCheckpoint(); updateNowPlaying()
    }
    public func jump(_ seconds: Double) { seek(to: position + seconds) }
    public func setRate(_ rate: Double) {
        snapshot.rate = min(3, max(0.5, rate)); if isPlaying { player.rate = Float(snapshot.rate) }
        previousPosition = nil; saveCheckpoint(); updateNowPlaying()
    }
    public func setRepeat(_ mode: RepeatMode) { snapshot.repeatMode = mode; saveCheckpoint() }
    public func toggleShuffle() { snapshot.shuffled.toggle(); shuffleRemaining = []; shuffleCycleStarted = false; saveCheckpoint() }
    public func enqueue(_ track: Track, next: Bool = false) {
        if snapshot.queue.isEmpty { setQueue([track]); return }
        if next { snapshot.queue.insert(track, at: min(snapshot.index + 1, snapshot.queue.count)) } else { snapshot.queue.append(track) }
        saveCheckpoint()
    }
    public func removeFromQueue(at index: Int) {
        guard snapshot.queue.indices.contains(index) else { return }
        if index == snapshot.index {
            finishHistory(completed: false); snapshot.queue.remove(at: index)
            if snapshot.queue.isEmpty { stop(); snapshot.index = 0; saveCheckpoint() } else { load(index: min(index, snapshot.queue.count - 1)) }
        } else { snapshot.queue.remove(at: index); if index < snapshot.index { snapshot.index -= 1 }; saveCheckpoint() }
    }
    public func moveQueue(from: Int, to: Int) {
        guard snapshot.queue.indices.contains(from), snapshot.queue.indices.contains(to), let currentID = currentTrack?.id else { return }
        let track = snapshot.queue.remove(at: from); snapshot.queue.insert(track, at: to)
        snapshot.index = snapshot.queue.firstIndex { $0.id == currentID } ?? 0; saveCheckpoint()
    }
    public func skip(to index: Int) { finishHistory(completed: false); load(index: index) }
    public func next(automatic: Bool = false) {
        guard !snapshot.queue.isEmpty else { return }
        if !automatic { finishHistory(completed: false) }
        let next: Int
        if snapshot.shuffled && snapshot.queue.count > 1 {
            if shuffleRemaining.isEmpty {
                if automatic && snapshot.repeatMode != .queue && shuffleCycleStarted { pause(); return }
                shuffleRemaining = snapshot.queue.filter { $0.id != currentTrack?.id }.map(\.id).shuffled()
                shuffleCycleStarted = true
            }
            guard let id = shuffleRemaining.popLast(), let index = snapshot.queue.firstIndex(where: { $0.id == id }) else { pause(); return }
            next = index
        } else { next = snapshot.index + 1 }
        if next >= snapshot.queue.count {
            if snapshot.repeatMode == .queue { load(index: 0) } else { pause() }
        } else { load(index: next) }
    }
    public func previous() {
        if position > 3 { seek(to: 0); return }
        finishHistory(completed: false); load(index: max(0, snapshot.index - 1))
    }
    public func preview(_ track: Track) {
        if previewSnapshot == nil { snapshot.position = position; saveCheckpoint(); finishHistory(completed: false); previewLyrics = lyrics; previewSnapshot = (snapshot, wantsPlayback) }
        snapshot.queue = [track]; snapshot.index = 0; load(index: 0)
    }
    public func endPreview() {
        guard let (original, wasPlaying) = previewSnapshot else { return }
        previewSnapshot = nil; stop(); snapshot = original; position = original.position; duration = currentTrack?.duration ?? 0
        lyrics = previewLyrics ?? LyricDocument(); previewLyrics = nil; chapters = []
        if wasPlaying { play() }
    }
    public func setLyrics(_ document: LyricDocument) { lyrics = document }
    public func setSleepTimer(minutes: Double?) {
        sleepTimer?.invalidate(); sleepTimer = nil; sleepEnd = nil
        guard let minutes, minutes > 0 else { return }
        sleepEnd = Date().addingTimeInterval(minutes * 60)
        sleepTimer = Timer.scheduledTimer(withTimeInterval: minutes * 60, repeats: false) { [weak self] _ in Task { @MainActor in self?.pause(); self?.sleepEnd = nil } }
    }
    public func shutdown() { pause(); stop(); sleepTimer?.invalidate(); spectrumTimer?.invalidate() }
    public func stop() {
        loadTask?.cancel(); generation = UUID(); wantsPlayback = false; player.pause(); player.replaceCurrentItem(with: nil)
        resourceLoader?.cancel(); resourceLoader = nil; visualizationTrack = nil; statusObservation = nil; loadedTrackID = nil
        isPlaying = false; isLoading = false; updateSpectrumDemand()
    }
    private func load(index: Int, position requestedPosition: Double? = nil, refresh: Bool = false, autoplay: Bool = true) {
        guard snapshot.queue.indices.contains(index) else { return }
        let track = snapshot.queue[index]
        stop(); wantsPlayback = autoplay; refreshedSource = refresh; snapshot.index = index; snapshot.position = 0; position = 0; errorMessage = nil; isLoading = true
        let token = UUID(); generation = token
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let local = try database.state(URL.self, key: "download-file:" + track.id)
                let source: ResolvedAudio
                if let local, FileManager.default.fileExists(atPath: local.path) {
                    let metadata = try database.state(OfflineAudioMetadata.self, key: "download-metadata:" + track.id)
                    source = ResolvedAudio(track: metadata?.track ?? track, url: local, measuredLoudness: metadata?.measuredLoudness, targetLoudness: metadata?.targetLoudness, chapters: metadata?.chapters ?? [])
                }
                else { source = try await provider.resolve(track) }
                try Task.checkCancellation()
                guard token == generation else { return }
                snapshot.queue[index] = source.track
                let asset: AVURLAsset
                if source.url.isFileURL { asset = AVURLAsset(url: source.url) }
                else { let loader = AudioResourceLoader(source: source, cache: cache); resourceLoader = loader; asset = loader.asset }
                let audioTracks = try await asset.loadTracks(withMediaType: .audio)
                try Task.checkCancellation(); guard token == generation else { return }
                let item = AVPlayerItem(asset: asset)
                visualizationTrack = audioTracks.first
                normalizationGain = Loudness.gain(measured: source.measuredLoudness, target: source.targetLoudness ?? -14)
                player.volume = Float(preferences.volume) * (preferences.normalization ? normalizationGain : 1)
                player.replaceCurrentItem(with: item)
                loadedTrackID = source.track.id; chapters = source.chapters
                duration = source.track.duration
                resetListeningSession()
                let saved = try database.resume(trackID: source.track.id)
                if requestedPosition == nil, track.duration > 600, let saved { snapshot.rate = saved.rate }
                let requested = requestedPosition ?? (track.duration > 600 ? saved?.position : nil) ?? 0
                let resume = track.duration > 0 && requested >= track.duration - 0.5 ? 0 : requested
                if resume > 0 { await player.seek(to: CMTime(seconds: resume, preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero); position = resume; snapshot.position = resume }
                try Task.checkCancellation(); guard token == generation else { return }
                statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
                    Task { @MainActor in
                        guard let self, token == self.generation else { return }
                        if item.status == .failed {
                            if !refresh { self.load(index: self.snapshot.index, position: self.position, refresh: true, autoplay: self.wantsPlayback) }
                            else { self.handleFailure(item.error ?? APIError.network("playback")) }
                        } else if item.status == .readyToPlay { self.isLoading = false; self.consecutiveFailures = 0 }
                    }
                }
                if wantsPlayback { player.playImmediately(atRate: Float(snapshot.rate)) }; onTrackChanged?(source.track)
                updateNowPlaying(); saveCheckpoint()
            } catch is CancellationError { }
            catch {
                guard token == generation else { return }
                if !refresh, !(error is APIError) { load(index: index, position: requestedPosition, refresh: true, autoplay: wantsPlayback) }
                else { handleFailure(error) }
            }
        }
    }
    private func handleFailure(_ error: Error) {
        pause(); isLoading = false; errorMessage = error.localizedDescription; onError?(error)
        if let apiError = error as? APIError, apiError.shouldSkipTrack {
            consecutiveFailures += 1
            if consecutiveFailures < 3 { next() }
        }
    }
    private func tick() {
        guard loadedTrackID != nil else { return }
        let time = player.currentTime().seconds
        if time.isFinite { position = max(0, time) }
        if let duration = player.currentItem?.duration.seconds, duration.isFinite, duration > 0 { self.duration = duration }
        let audible = player.timeControlStatus == .playing && player.rate > 0
        let clock = ProcessInfo.processInfo.systemUptime
        if previewSnapshot == nil {
            _ = accumulator.update(clock: clock, audible: audible)
            if audible, let previousPosition { coveredMedia += max(0, min(position - previousPosition, 2 * snapshot.rate)) }
        }
        previousPosition = audible ? position : nil
        if clock - lastCheckpoint > 5 { saveCheckpoint(); lastCheckpoint = clock }
    }
    public func saveCheckpoint() {
        guard previewSnapshot == nil else { return }
        snapshot.position = position
        do {
            try database.saveState(snapshot, key: "playback")
            try database.saveState(preferences, key: "preferences")
            if let track = currentTrack {
                try database.saveResume(trackID: track.id, position: position, rate: snapshot.rate)
                if accumulator.audibleSeconds > 0 { try database.checkpointHistory(id: historyID, track: track, started: historyStart, listened: accumulator.audibleSeconds, completed: false) }
            }
        } catch { errorMessage = "保存播放进度失败：\(error.localizedDescription)" }
    }
    private func captureAudibleTail() {
        let time = player.currentTime().seconds
        guard time.isFinite else { return }
        if previewSnapshot == nil {
            _ = accumulator.update(clock: ProcessInfo.processInfo.systemUptime, audible: true)
            if let previousPosition { coveredMedia += max(0, min(time - previousPosition, 2 * snapshot.rate)) }
        }
        position = time; previousPosition = time
    }
    private func resetListeningSession() {
        historyID = UUID().uuidString; historyStart = Date(); accumulator = ListeningAccumulator(); coveredMedia = 0; previousPosition = nil
    }
    private func finishHistory(completed: Bool) {
        guard previewSnapshot == nil, let track = currentTrack, accumulator.audibleSeconds > 0 else { return }
        do { try database.checkpointHistory(id: historyID, track: track, started: historyStart, listened: accumulator.audibleSeconds, completed: completed) }
        catch { errorMessage = "保存听歌记录失败：\(error.localizedDescription)" }
    }
    private func applyPreferences() {
        player.volume = Float(max(0, min(1, preferences.volume))) * (preferences.normalization ? normalizationGain : 1)
        updateSpectrumDemand()
        try? database.saveState(preferences, key: "preferences")
        Task { try? await cache.setLimit(preferences.cacheLimit) }
    }
    private func makeTap() -> MTAudioProcessingTap? {
        var callbacks = MTAudioProcessingTapCallbacks(version: kMTAudioProcessingTapCallbacksVersion_0, clientInfo: UnsafeMutableRawPointer(pcm), init: { _, info, storage in
            storage.pointee = info
            bb_pcm_retain(OpaquePointer(info))
        }, finalize: { tap in bb_pcm_destroy(OpaquePointer(MTAudioProcessingTapGetStorage(tap))) }, prepare: { tap, _, format in
            let state = OpaquePointer(MTAudioProcessingTapGetStorage(tap))
            let isFloat = format.pointee.mFormatID == kAudioFormatLinearPCM && format.pointee.mBitsPerChannel == 32 && (format.pointee.mFormatFlags & kAudioFormatFlagIsFloat) != 0
            bb_pcm_set_format(state, isFloat)
        }, unprepare: { _ in }, process: { tap, frames, _, list, outputFrames, outputFlags in
            let status = MTAudioProcessingTapGetSourceAudio(tap, frames, list, outputFlags, nil, outputFrames)
            guard status == noErr, outputFrames.pointee > 0 else { return }
            let first = list.pointee.mBuffers
            guard let data = first.mData else { return }
            bb_pcm_push(OpaquePointer(MTAudioProcessingTapGetStorage(tap)), data.assumingMemoryBound(to: Float.self), Int(outputFrames.pointee), max(1, Int(first.mNumberChannels)))
        })
        var tap: MTAudioProcessingTap?
        guard MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks, kMTAudioProcessingTapCreationFlag_PreEffects, &tap) == noErr else { return nil }
        return tap
    }
    private func updateSpectrumDemand() {
        let interval = visualizerVisible || preferences.floatingLyrics ? 0.25 : 1.0
        if interval != progressInterval {
            if let timeToken { player.removeTimeObserver(timeToken) }
            progressInterval = interval
            timeToken = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: interval, preferredTimescale: 1000), queue: .main) { [weak self] _ in
                Task { @MainActor in self?.tick() }
            }
        }
        if isPlaying, playbackActivity == nil {
            playbackActivity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep, reason: "User-requested audio playback")
        } else if !isPlaying, let activity = playbackActivity {
            ProcessInfo.processInfo.endActivity(activity); playbackActivity = nil
        }
        let enabled = preferences.spectrum && visualizerVisible && isPlaying
        bb_pcm_enable(pcm, enabled)
        if let item = player.currentItem {
            if enabled, item.audioMix == nil, let track = visualizationTrack, let tap = makeTap() {
                let mix = AVMutableAudioMix(), parameter = AVMutableAudioMixInputParameters(track: track)
                parameter.audioTapProcessor = tap; mix.inputParameters = [parameter]; item.audioMix = mix
            } else if !enabled, item.audioMix != nil { item.audioMix = nil }
        }
        if enabled && spectrumTimer == nil {
            spectrumTimer = Timer.scheduledTimer(withTimeInterval: 1 / 30, repeats: true) { [weak self] _ in Task { @MainActor in self?.sampleSpectrum() } }
        } else if !enabled { spectrumTimer?.invalidate(); spectrumTimer = nil; spectrum = Array(repeating: 0, count: 48) }
    }
    private func sampleSpectrum() {
        let count = fftReal.withUnsafeMutableBufferPointer { bb_pcm_read(pcm, $0.baseAddress, 1024) }
        guard count == 1024, let fft else { return }
        vDSP_vmul(fftReal, 1, fftWindow, 1, &fftReal, 1, 1024)
        vDSP_DFT_Execute(fft, fftReal, fftImag, &fftOutReal, &fftOutImag)
        var values = spectrum
        for band in 0..<48 {
            let lower = max(1, Int(pow(512, Double(band) / 48))), upper = max(lower + 1, Int(pow(512, Double(band + 1) / 48)))
            var magnitude: Float = 0
            for bin in lower..<min(512, upper) { magnitude = max(magnitude, hypotf(fftOutReal[bin], fftOutImag[bin]) / 512) }
            let target = max(0, min(1, (20 * log10f(max(magnitude, 0.0001)) + 70) / 70))
            values[band] = values[band] * 0.65 + target * 0.35
        }
        spectrum = values
    }
    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in Task { @MainActor in self?.play() }; return .success }
        center.pauseCommand.addTarget { [weak self] _ in Task { @MainActor in self?.pause() }; return .success }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in Task { @MainActor in self?.toggle() }; return .success }
        center.nextTrackCommand.addTarget { [weak self] _ in Task { @MainActor in self?.next() }; return .success }
        center.previousTrackCommand.addTarget { [weak self] _ in Task { @MainActor in self?.previous() }; return .success }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor in self?.seek(to: event.positionTime) }; return .success
        }
    }
    private func updateNowPlaying() {
        guard let track = currentTrack else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [MPMediaItemPropertyTitle: track.title, MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyPlaybackDuration: duration, MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? snapshot.rate : 0]
        MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
    }
}
