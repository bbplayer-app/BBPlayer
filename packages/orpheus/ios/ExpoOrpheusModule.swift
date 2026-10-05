import ExpoModulesCore
import MMKV

public class ExpoOrpheusModule: Module {

    private func setupEventListeners() {
        if !Thread.isMainThread {
            DispatchQueue.main.sync { self.setupEventListeners() }
            return
        }
        let manager = OrpheusPlayerManager.shared

        manager.onPlaybackStateChanged = { [weak self] state in
            self?.sendEvent("onPlaybackStateChanged", ["state": state.rawValue])
        }

        manager.onTrackStarted = { [weak self] trackId, reason in
            self?.sendEvent("onTrackStarted", [
                "trackId": trackId,
                "reason": reason.rawValue
            ])
        }

        manager.onPositionUpdate = { [weak self] position, duration, buffered in
            self?.sendEvent("onPositionUpdate", [
                "position": position,
                "duration": duration,
                "buffered": buffered
            ])
        }

        OrpheusDownloadManager.shared.onDownloadUpdated = { [weak self] task in
            self?.sendEvent("onDownloadUpdated", [
                "id": task.id,
                "state": task.state.rawValue,
                "percentDownloaded": task.percentDownloaded,
                "bytesDownloaded": task.bytesDownloaded,
                "contentLength": task.contentLength
            ])
        }

        manager.onTrackFinished = { [weak self] trackId, finalPosition, duration, summary in
            var payload: [String: Any] = ["trackId": trackId, "finalPosition": finalPosition, "duration": duration]
            if let summary = summary { payload["playbackSummary"] = summary.dictionary }
            self?.sendEvent("onTrackFinished", payload)
        }

        manager.onPlayerError = { [weak self] errorMsg in
            self?.sendEvent("onPlayerError", ["platform": "ios", "error": errorMsg])
        }

        manager.onIsPlayingChanged = { [weak self] isPlaying in
            self?.sendEvent("onIsPlayingChanged", ["status": isPlaying])
        }

        manager.onQueueChanged = { [weak self] in
            self?.sendEvent("onQueueChanged", [:])
        }
    }

    public func definition() -> ModuleDefinition {
        Name("Orpheus")


        Events(
            "onPlaybackStateChanged",
            "onPlayerError",
            "onPositionUpdate",
            "onIsPlayingChanged",
            "onDownloadUpdated",
            "onPlaybackSpeedChanged",
            "onSpectrumVisualizerError",
            "onSpectrumVisualizerEnabledChanged",
            "onHeadlessEvent",
            "onTrackStarted",
            "onTrackFinished",
            "onQueueChanged"
        )

        OnCreate {
            MMKV.initialize(rootDir: nil)
            self.setupEventListeners()
        }

        // MARK: - Preferences

        Property("restorePlaybackPositionEnabled")
            .get { GeneralStorage.shared.isRestoreEnabled }
            .set { GeneralStorage.shared.isRestoreEnabled = $0 }

        Property("loudnessNormalizationEnabled")
            .get { GeneralStorage.shared.isLoudnessNormalizationEnabled }
            .set { GeneralStorage.shared.isLoudnessNormalizationEnabled = $0 }

        Property("autoplayOnStartEnabled")
            .get { GeneralStorage.shared.isAutoplayOnStartEnabled }
            .set { GeneralStorage.shared.isAutoplayOnStartEnabled = $0 }

        Property("isSpectrumVisualizerEnabled")
            .get { GeneralStorage.shared.isSpectrumVisualizerEnabled }
            .set {
                GeneralStorage.shared.isSpectrumVisualizerEnabled = $0
                self.sendEvent("onSpectrumVisualizerEnabledChanged", ["enabled": $0])
            }

    // MARK: - Getters

    AsyncFunction("getPosition") { () -> Double in
        return OrpheusPlayerManager.shared.getPosition()
    }.runOnQueue(.main)

    AsyncFunction("getDuration") { () -> Double in
        return OrpheusPlayerManager.shared.getDuration()
    }.runOnQueue(.main)

    AsyncFunction("getBuffered") { () -> Double in
        return OrpheusPlayerManager.shared.getBufferedPosition()
    }.runOnQueue(.main)

    AsyncFunction("getIsPlaying") { () -> Bool in
        return OrpheusPlayerManager.shared.isPlaying()
    }.runOnQueue(.main)

    AsyncFunction("getCurrentIndex") { () -> Int in
        return OrpheusPlayerManager.shared.getCurrentIndex()
    }.runOnQueue(.main)

    AsyncFunction("getCurrentTrack") { () -> Track? in
        return OrpheusPlayerManager.shared.getCurrentTrack()
    }.runOnQueue(.main)

    AsyncFunction("getQueue") { () -> [Track] in
        return OrpheusPlayerManager.shared.getQueue()
    }.runOnQueue(.main)

    AsyncFunction("getIndexTrack") { (index: Int) -> Track? in
        return OrpheusPlayerManager.shared.getTrack(at: index)
    }.runOnQueue(.main)

    AsyncFunction("getPlaybackSpeed") { () -> Double in
        return Double(OrpheusPlayerManager.shared.getPlaybackSpeed())
    }.runOnQueue(.main)

    AsyncFunction("getRepeatMode") { () -> Int in
        return OrpheusPlayerManager.shared.repeatMode.rawValue
    }.runOnQueue(.main)

    AsyncFunction("getAdjacentTracks") { () -> [String: Track?] in
        return OrpheusPlayerManager.shared.getAdjacentTracks()
    }.runOnQueue(.main)

    AsyncFunction("getShuffleMode") { () -> Bool in
        return OrpheusPlayerManager.shared.shuffleMode
    }.runOnQueue(.main)

    // MARK: - Controls

    AsyncFunction("play") {
        OrpheusPlayerManager.shared.play()
    }.runOnQueue(.main)
    AsyncFunction("pause") {
        OrpheusPlayerManager.shared.pause()
    }.runOnQueue(.main)

    AsyncFunction("skipToNext") {
        OrpheusPlayerManager.shared.playNext()
    }.runOnQueue(.main)

    AsyncFunction("skipToPrevious") {
        OrpheusPlayerManager.shared.skipToPrevious()
    }.runOnQueue(.main)

    AsyncFunction("seekTo") { (seconds: Double) in
        OrpheusPlayerManager.shared.seek(to: seconds)
    }.runOnQueue(.main)

    AsyncFunction("skipTo") { (index: Int) in
        OrpheusPlayerManager.shared.skipTo(index: index)
    }.runOnQueue(.main)

    AsyncFunction("addToEnd") { (tracks: [Track], startFromId: String?, clearQueue: Bool) in
        OrpheusPlayerManager.shared.addToEnd(tracks: tracks, startFromId: startFromId, clearQueue: clearQueue)
    }.runOnQueue(.main)

    AsyncFunction("playNext") { (track: Track) in
        OrpheusPlayerManager.shared.addToNext(track: track)
    }.runOnQueue(.main)

    AsyncFunction("removeTrack") { (index: Int) in
        OrpheusPlayerManager.shared.removeTrack(at: index)
    }.runOnQueue(.main)

    AsyncFunction("moveTrack") { (fromIndex: Int, toIndex: Int) in
        OrpheusPlayerManager.shared.moveTrack(fromIndex: fromIndex, toIndex: toIndex)
    }.runOnQueue(.main)

    AsyncFunction("clear") {
         OrpheusPlayerManager.shared.clearQueue()
    }.runOnQueue(.main)

    AsyncFunction("reverseRemainingQueue") {
        OrpheusPlayerManager.shared.reverseRemainingQueue()
    }.runOnQueue(.main)

    AsyncFunction("setPlaybackSpeed") { (speed: Double) in
        OrpheusPlayerManager.shared.setPlaybackSpeed(Float(speed))
    }.runOnQueue(.main)

    Function("setBilibiliCookie") { (cookie: String) in
        BilibiliApi.shared.setCookie(cookie)
    }

    AsyncFunction("setShuffleMode") { (enabled: Bool) in
        OrpheusPlayerManager.shared.setExecuteShuffleMode(enabled)
    }.runOnQueue(.main)

    AsyncFunction("setRepeatMode") { (mode: Int) in
        if let repeatMode = RepeatMode(rawValue: mode) {
            OrpheusPlayerManager.shared.setExecuteRepeatMode(repeatMode)
        }
    }.runOnQueue(.main)

    AsyncFunction("setSleepTimer") { (durationMs: Double) in
        OrpheusPlayerManager.shared.setSleepTimer(durationMs: durationMs)
    }.runOnQueue(.main)

    AsyncFunction("getSleepTimerEndTime") { () -> Double? in
        return OrpheusPlayerManager.shared.getSleepTimerEndTime()
    }.runOnQueue(.main)

    AsyncFunction("cancelSleepTimer") {
        OrpheusPlayerManager.shared.cancelSleepTimer()
    }.runOnQueue(.main)

    AsyncFunction("setAbLoop") { (trackId: String, startSec: Double, endSec: Double) -> Bool in
        return OrpheusPlayerManager.shared.setAbLoop(trackId: trackId, startSec: startSec, endSec: endSec)
    }.runOnQueue(.main)

    AsyncFunction("clearAbLoop") { (trackId: String) -> Bool in
        return OrpheusPlayerManager.shared.clearAbLoop(trackId: trackId)
    }.runOnQueue(.main)

    AsyncFunction("seekToForTrack") { (trackId: String, seconds: Double) -> Bool in
        let manager = OrpheusPlayerManager.shared
        guard manager.getCurrentTrack()?.id == trackId, seconds.isFinite, seconds >= 0 else { return false }
        manager.seek(to: seconds)
        return true
    }.runOnQueue(.main)

    AsyncFunction("setAbLoopPreview") { (trackId: String, range: AbLoopRange?) -> Bool in
        return OrpheusPlayerManager.shared.setAbLoopPreview(trackId: trackId, range: range)
    }.runOnQueue(.main)

    AsyncFunction("clearAbLoopPreview") { (trackId: String) -> Bool in
        return OrpheusPlayerManager.shared.clearAbLoopPreview(trackId: trackId)
    }.runOnQueue(.main)

    AsyncFunction("getAbLoop") { () -> [String: Any]? in
        guard let loop = OrpheusPlayerManager.shared.getAbLoop() else {
            return nil
        }
        return [
            "trackId": loop.trackId,
            "start": loop.startSec,
            "end": loop.endSec,
        ]
    }.runOnQueue(.main)

    // MARK: - Downloads

    Function("downloadTrack") { (track: Track) in
        OrpheusDownloadManager.shared.downloadTrack(track: track)
    }

    Function("multiDownload") { (tracks: [Track]) in
        OrpheusDownloadManager.shared.multiDownload(tracks: tracks)
    }

    Function("resumeDownload") { (id: String) in
        OrpheusDownloadManager.shared.resumeDownload(id: id)
    }

    Function("retryDownload") { (track: Track) in
        OrpheusDownloadManager.shared.downloadTrack(track: track)
    }

    Function("setDownloadMaxParallelTasks") { (_: Int) in
        // iOS download concurrency is currently managed by URLSession.
    }

    Function("removeDownload") { (id: String) in
        OrpheusDownloadManager.shared.removeDownload(id: id)
    }

    Function("removeDownloads") { (ids: [String]) in
        for id in ids {
            OrpheusDownloadManager.shared.removeDownload(id: id)
        }
    }

    Function("removeAllDownloads") {
        OrpheusDownloadManager.shared.removeAllDownloads()
    }

    Function("getDownloads") { () -> [DownloadTask] in
        return OrpheusDownloadManager.shared.getDownloads()
    }

    Function("getCompletedDownloadTasks") { () -> [DownloadTask] in
        return OrpheusDownloadManager.shared.getCompletedTasks()
    }

    Function("getDownloadStatusByIds") { (ids: [String]) -> [String: Int] in
        return OrpheusDownloadManager.shared.getDownloadStatusByIds(ids: ids)
    }

    Function("clearUncompletedDownloadTasks") {
        OrpheusDownloadManager.shared.clearUncompletedTasks()
    }

    Function("getUncompletedDownloadTasks") { () -> [DownloadTask] in
         return OrpheusDownloadManager.shared.getUncompletedTasks()
    }

    AsyncFunction("checkOverlayPermission") { () -> Bool in
        return false
    }

    AsyncFunction("requestOverlayPermission") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("showDesktopLyrics") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("hideDesktopLyrics") {
         throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("clearOverlays") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setLyricsInternal") { (_: String, _: [String]) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setDesktopLyricsInternal") { (lyricsJson: String) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setStatusBarLyricsInternal") { (lyricsJson: String) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("debugTriggerError") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    Function("updateSpectrumData") { (destination: TypedArray) in
        let count = destination.length
        // Get the unsafe pointer to valid memory
        let pointer = destination.getUnsafeMutablePointer(Float32.self)

        if let ptr = pointer {
            AudioSpectrumAnalyzer.shared.fillSpectrumData(destination: ptr, count: count)
        }
    }

  }
}
