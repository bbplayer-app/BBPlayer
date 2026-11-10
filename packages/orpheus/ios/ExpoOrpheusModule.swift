import ExpoModulesCore
import MMKV

public class ExpoOrpheusModule: Module {

    private func setupEventListeners() {
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
            var payload: [String: Any] = [
                "id": task.id,
                "state": task.state.rawValue,
                "percentDownloaded": task.percentDownloaded,
                "bytesDownloaded": task.bytesDownloaded,
                "contentLength": task.contentLength
            ]
            if let track = task.track {
                payload["track"] = track.dictionaryRepresentation
            }
            self?.sendEvent("onDownloadUpdated", payload)
        }

        manager.onTrackFinished = { [weak self] trackId, finalPosition, duration in
            self?.sendEvent("onTrackFinished", [
                "trackId": trackId,
                "finalPosition": finalPosition,
                "duration": duration
            ])
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

        manager.onPlaybackSpeedChanged = { [weak self] speed in
            self?.sendEvent("onPlaybackSpeedChanged", ["speed": speed])
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
            "onQueueChanged",
            "onCoverDownloadProgress",
            "onExportProgress",
            "onStatusBarLyricsStatusChanged",
            "onRequestClearLyrics"
        )

        OnCreate {
            MMKV.initialize(rootDir: nil)
            self.setupEventListeners()
        }

        // MARK: - Preferences

        Property("preferredBilibiliCdn")
            .get { GeneralStorage.shared.preferredBilibiliCdn }
            .set { GeneralStorage.shared.preferredBilibiliCdn = $0 }

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
            .set { (enabled: Bool) in
                GeneralStorage.shared.isSpectrumVisualizerEnabled = enabled
                self.sendEvent("onSpectrumVisualizerEnabledChanged", ["enabled": enabled])
            }

        Property("isNotificationArtworkEnabled")
            .get { GeneralStorage.shared.isNotificationArtworkEnabled }
            .set { GeneralStorage.shared.isNotificationArtworkEnabled = $0 }

        Property("playbackResumeStrategy")
            .get { GeneralStorage.shared.playbackResumeStrategy }
            .set { GeneralStorage.shared.playbackResumeStrategy = $0 }

        // Desktop, status bar and in-car lyrics are Android system features with no
        // iOS counterpart. Shared settings screens still read these, so they stay off.
        Property("isDesktopLyricsShown").get { false }.set { (_: Bool) in }
        Property("isDesktopLyricsLocked").get { false }.set { (_: Bool) in }
        Property("isStatusBarLyricsEnabled").get { false }.set { (_: Bool) in }
        Property("isCarLyricsEnabled").get { false }.set { (_: Bool) in }
        Property("statusBarLyricsProvider").get { "superlyric" }.set { (_: String) in }
        Property("isSuperLyricApiEnabled").get { false }
        Property("isLyriconApiEnabled").get { false }
        Property("isMeizuStatusBarLyricsApiEnabled").get { false }

    // MARK: - Getters

    // Everything touching the queue or player runs on main, alongside AVPlayer's own callbacks.

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

    Function("setDownloadMaxParallelTasks") { (maxParallelTasks: Int) in
        OrpheusDownloadManager.shared.setMaxParallelTasks(maxParallelTasks)
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

    AsyncFunction("setAllowSimultaneousPlayback") { (enabled: Bool) in
        try OrpheusPlayerManager.shared.setAllowSimultaneousPlayback(enabled)
    }.runOnQueue(.main)

    // AVPlayer streams are not kept in an on-disk LRU cache on iOS.
    AsyncFunction("clearPlaybackCache") { () -> Void in }

    Function("getLruCachedUris") { (_: [String]) -> [String] in
        return []
    }

    // Cover art is not stored for offline use on iOS yet.
    Function("getDownloadedCoverUri") { (_: String) -> String? in
        return nil
    }

    AsyncFunction("downloadMissingCovers") { () -> Int in
        return 0
    }

    AsyncFunction("exportDownloads") { (_: [String], _: String, _: String?, _: Bool, _: Bool, _: Bool) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("selectDirectory") { () -> String? in
        return nil
    }

    AsyncFunction("isDirectoryPickerAvailable") { () -> Bool in
        return false
    }

    Function("exportData") { () -> [String: Any] in
        return [
            "playerQueue": GeneralStorage.shared.exportConfig(),
            "loudness": [String: Double]()
        ]
    }

    Function("importData") { (data: [String: Any]) in
        if let config = data["playerQueue"] as? [String: Any] {
            GeneralStorage.shared.importConfig(config)
        }
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

    AsyncFunction("setDesktopLyricsSuppressed") { (_: Bool) in
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

    Function("updateSpectrumData") { (destination: Float32Array) in
        let pointer = destination.rawPointer.assumingMemoryBound(to: Float32.self)
        AudioSpectrumAnalyzer.shared.fillSpectrumData(destination: pointer, count: destination.length)
    }

  }
}
