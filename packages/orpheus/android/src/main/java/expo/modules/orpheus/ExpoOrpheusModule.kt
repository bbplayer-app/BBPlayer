package expo.modules.orpheus

import android.content.ComponentName
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.net.toUri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.gson.Gson
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.orpheus.models.TrackRecord
import expo.modules.orpheus.utils.DownloadUtil
import expo.modules.orpheus.utils.GeneralStorage
import expo.modules.orpheus.utils.LoudnessStorage
import expo.modules.orpheus.utils.toJsMap
import expo.modules.orpheus.utils.toMediaItem

@UnstableApi
class ExpoOrpheusModule : Module() {
    // keep this controller only to make sure MediaLibraryService is init.
    private var controllerFuture: ListenableFuture<MediaController>? = null

    private var player: Player? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    private var downloadManager: DownloadManager? = null

    // 记录上一首歌曲的 ID，用于在切歌时发送给 JS
    private var lastMediaId: String? = null
    
    val gson = Gson()

    private val playerListener = object : Player.Listener {

        /**
         * 核心：处理切歌、播放结束逻辑
         */
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val newId = mediaItem?.mediaId ?: ""
            Log.e("Orpheus", "onMediaItemTransition: $reason")

            // Headless task is handled by Service, no need to send event here if removed from API
            lastMediaId = newId
            saveCurrentPosition()
        }

        override fun onTimelineChanged(timeline: Timeline, reason: Int) {
            // Logic moved to Service
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) {
            // Logic moved to Service
        }



        /**
         * 处理播放状态改变
         */
        override fun onPlaybackStateChanged(state: Int) {
            // state: 1=IDLE, 2=BUFFERING, 3=READY, 4=ENDED
            sendEvent(
                "onPlaybackStateChanged", mapOf(
                    "state" to state
                )
            )

            updateProgressRunnerState()
        }

        /**
         * 处理播放/暂停状态
         */
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            sendEvent(
                "onIsPlayingChanged", mapOf(
                    "status" to isPlaying
                )
            )
            updateProgressRunnerState()
        }

        /**
         * 处理错误
         */
        override fun onPlayerError(error: PlaybackException) {
            val map = error.toJsMap().toMutableMap()
            map["platform"] = "android"
            sendEvent("onPlayerError", map)
        }

        override fun onRepeatModeChanged(repeatMode: Int) {
            super.onRepeatModeChanged(repeatMode)
            GeneralStorage.saveRepeatMode(repeatMode)
        }

        override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
            super.onShuffleModeEnabledChanged(shuffleModeEnabled)
            GeneralStorage.saveShuffleMode(shuffleModeEnabled)
        }

        override fun onPlaybackParametersChanged(playbackParameters: androidx.media3.common.PlaybackParameters) {
            sendEvent(
                "onPlaybackSpeedChanged", mapOf(
                    "speed" to playbackParameters.speed
                )
            )
        }
    }

    @OptIn(UnstableApi::class)
    override fun definition() = ModuleDefinition {
        Name("Orpheus")

        Events(
            "onPlaybackStateChanged",
            "onPlayerError",
            "onPositionUpdate",
            "onIsPlayingChanged",
            "onDownloadUpdated",
            "onPlaybackSpeedChanged",
            "onTrackStarted",
            "onTrackFinished"
        )

        OnCreate {
            val context = appContext.reactContext ?: return@OnCreate
            GeneralStorage.initialize(context)
            LoudnessStorage.initialize(context)
            val sessionToken = SessionToken(
                context,
                ComponentName(context, OrpheusMusicService::class.java)
            )
            controllerFuture = MediaController.Builder(context, sessionToken)
                .setApplicationLooper(Looper.getMainLooper()).buildAsync()


            OrpheusMusicService.addOnServiceReadyListener { service ->
                mainHandler.post {
                    if (this@ExpoOrpheusModule.player != service.player) {
                        this@ExpoOrpheusModule.player?.removeListener(playerListener)
                        this@ExpoOrpheusModule.player = service.player
                        this@ExpoOrpheusModule.player?.addListener(playerListener)
                    }
                    
                    service.addTrackEventListener(object : OrpheusMusicService.TrackEventListener {
                        override fun onTrackStarted(trackId: String, reason: Int) {
                            sendEvent("onTrackStarted", mapOf(
                                "trackId" to trackId,
                                "reason" to reason
                            ))
                        }

                        override fun onTrackFinished(trackId: String, finalPosition: Double, duration: Double) {
                            sendEvent("onTrackFinished", mapOf(
                                "trackId" to trackId,
                                "finalPosition" to finalPosition,
                                "duration" to duration
                            ))
                        }
                    })
                }
            }

            downloadManager = DownloadUtil.getDownloadManager(context)
            downloadManager?.addListener(downloadListener)
        }

        OnDestroy {
            mainHandler.removeCallbacks(progressSendEventRunnable)
            mainHandler.removeCallbacks(progressSaveRunnable)
            mainHandler.removeCallbacks(downloadProgressRunnable)
            controllerFuture?.let { MediaController.releaseFuture(it) }
            downloadManager?.removeListener(downloadListener)
            player?.removeListener(playerListener)
            OrpheusMusicService.removeOnServiceReadyListener { }
            player = null
            Log.d("Orpheus", "Destroy media controller")
        }

        Property("restorePlaybackPositionEnabled")
            .get { GeneralStorage.isRestoreEnabled() }
            .set { enabled: Boolean -> GeneralStorage.setRestoreEnabled(enabled) }

        Property("loudnessNormalizationEnabled")
            .get { GeneralStorage.isLoudnessNormalizationEnabled() }
            .set { enabled: Boolean -> GeneralStorage.setLoudnessNormalizationEnabled(enabled) }

        Property("autoplayOnStartEnabled")
            .get { GeneralStorage.isAutoplayOnStartEnabled() }
            .set { enabled: Boolean -> GeneralStorage.setAutoplayOnStartEnabled(enabled) }

        Property("isDesktopLyricsShown")
            .get { GeneralStorage.isDesktopLyricsShown() }

        Property("isDesktopLyricsLocked")
            .get { GeneralStorage.isDesktopLyricsLocked() }
            .set { locked: Boolean ->
                mainHandler.post {
                    OrpheusMusicService.instance?.floatingLyricsManager?.setLocked(locked)
                }
            }


        Function("setBilibiliCookie") { cookie: String ->
            OrpheusConfig.bilibiliCookie = cookie
        }

        AsyncFunction("getPosition") {
            checkPlayer()
            player?.currentPosition?.toDouble()?.div(1000.0) ?: 0.0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getDuration") {
            checkPlayer()
            val d = player?.duration ?: C.TIME_UNSET
            if (d == C.TIME_UNSET) 0.0 else d.toDouble() / 1000.0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getBuffered") {
            checkPlayer()
            player?.bufferedPosition?.toDouble()?.div(1000.0) ?: 0.0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getIsPlaying") {
            checkPlayer()
            player?.isPlaying ?: false
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getCurrentIndex") {
            checkPlayer()
            player?.currentMediaItemIndex ?: -1
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getCurrentTrack") {
            checkPlayer()
            val p = player ?: return@AsyncFunction null
            val currentItem = p.currentMediaItem ?: return@AsyncFunction null

            mediaItemToTrackRecord(currentItem)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getShuffleMode") {
            checkPlayer()
            player?.shuffleModeEnabled
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getIndexTrack") { index: Int ->
            checkPlayer()
            val p = player ?: return@AsyncFunction null

            if (index < 0 || index >= p.mediaItemCount) {
                return@AsyncFunction null
            }

            val item = p.getMediaItemAt(index)

            mediaItemToTrackRecord(item)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("play") {
            checkPlayer()
            player?.play()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("pause") {
            checkPlayer()
            player?.pause()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("clear") {
            checkPlayer()
            player?.clearMediaItems()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("skipTo") { index: Int ->
            // 跳转到指定索引的开头
            checkPlayer()
            player?.seekTo(index, C.TIME_UNSET)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("skipToNext") {
            checkPlayer()
            if (player?.hasNextMediaItem() == true) {
                player?.seekToNextMediaItem()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("skipToPrevious") {
            checkPlayer()
            if (player?.hasPreviousMediaItem() == true) {
                player?.seekToPreviousMediaItem()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("seekTo") { seconds: Double ->
            checkPlayer()
            val ms = (seconds * 1000).toLong()
            player?.seekTo(ms)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setRepeatMode") { mode: Int ->
            checkPlayer()
            // mode: 0=OFF, 1=TRACK, 2=QUEUE
            val repeatMode = when (mode) {
                1 -> Player.REPEAT_MODE_ONE
                2 -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
            player?.repeatMode = repeatMode
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setShuffleMode") { enabled: Boolean ->
            checkPlayer()
            player?.shuffleModeEnabled = enabled
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getRepeatMode") {
            checkPlayer()
            player?.repeatMode
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("removeTrack") { index: Int ->
            checkPlayer()
            if (index >= 0 && index < (player?.mediaItemCount ?: 0)) {
                player?.removeMediaItem(index)
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getQueue") {
            checkPlayer()
            val p = player ?: return@AsyncFunction emptyList<TrackRecord>()
            val count = p.mediaItemCount
            val queue = ArrayList<TrackRecord>(count)

            for (i in 0 until count) {
                val item = p.getMediaItemAt(i)
                queue.add(mediaItemToTrackRecord(item))
            }

            return@AsyncFunction queue
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setSleepTimer") { durationMs: Long ->
            OrpheusMusicService.instance?.startSleepTimer(durationMs)
            return@AsyncFunction null
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getSleepTimerEndTime") {
            return@AsyncFunction OrpheusMusicService.instance?.getSleepTimerRemaining()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("cancelSleepTimer") {
            OrpheusMusicService.instance?.cancelSleepTimer()
            return@AsyncFunction null
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("addToEnd") { tracks: List<TrackRecord>, startFromId: String?, clearQueue: Boolean? ->
            checkPlayer()
            val mediaItems = tracks.map { track ->
                track.toMediaItem(gson)
            }
            val p = player ?: return@AsyncFunction
            if (clearQueue == true) {
                p.clearMediaItems()
            }
            val initialSize = p.mediaItemCount
            p.addMediaItems(mediaItems)

            if (!startFromId.isNullOrEmpty()) {
                val relativeIndex = tracks.indexOfFirst { it.id == startFromId }

                if (relativeIndex != -1) {
                    val targetIndex = initialSize + relativeIndex

                    p.seekTo(targetIndex, C.TIME_UNSET)
                    p.prepare()
                    p.play()

                    return@AsyncFunction
                }
            }

            if (p.playbackState == Player.STATE_IDLE) {
                p.prepare()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("playNext") { track: TrackRecord ->
            checkPlayer()
            val p = player ?: return@AsyncFunction

            val mediaItem = track.toMediaItem(gson)
            val targetIndex = p.currentMediaItemIndex + 1

            var existingIndex = -1
            for (i in 0 until p.mediaItemCount) {
                if (p.getMediaItemAt(i).mediaId == track.id) {
                    existingIndex = i
                    break
                }
            }

            if (existingIndex != -1) {
                if (existingIndex == p.currentMediaItemIndex) {
                    return@AsyncFunction
                }
                val safeTargetIndex = targetIndex.coerceAtMost(p.mediaItemCount)

                p.moveMediaItem(existingIndex, safeTargetIndex)

            } else {
                val safeTargetIndex = targetIndex.coerceAtMost(p.mediaItemCount)

                p.addMediaItem(safeTargetIndex, mediaItem)
            }

            if (p.playbackState == Player.STATE_IDLE) {
                p.prepare()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("downloadTrack") { track: TrackRecord ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val downloadRequest = DownloadRequest.Builder(track.id, track.url.toUri())
                .setData(gson.toJson(track).toByteArray())
                .build()

            DownloadService.sendAddDownload(
                context,
                OrpheusDownloadService::class.java,
                downloadRequest,
                false
            )
        }

        AsyncFunction("multiDownload") { tracks: List<TrackRecord> ->
            val context = appContext.reactContext ?: return@AsyncFunction
            tracks.forEach { track ->
                val downloadRequest = DownloadRequest.Builder(track.id, track.url.toUri())
                    .setData(gson.toJson(track).toByteArray())
                    .build()
                DownloadService.sendAddDownload(
                    context,
                    OrpheusDownloadService::class.java,
                    downloadRequest,
                    false
                )
            }
            return@AsyncFunction
        }

        AsyncFunction("removeDownload") { id: String ->
            val context = appContext.reactContext ?: return@AsyncFunction
            DownloadService.sendRemoveDownload(
                context,
                OrpheusDownloadService::class.java,
                id,
                false
            )
        }

        AsyncFunction("removeAllDownloads") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            DownloadService.sendRemoveAllDownloads(
                context,
                OrpheusDownloadService::class.java,
                false
            )
        }

        AsyncFunction("getDownloads") {
            val context =
                appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
            val downloadManager = DownloadUtil.getDownloadManager(context)
            val downloadIndex = downloadManager.downloadIndex

            val cursor = downloadIndex.getDownloads()
            val result = ArrayList<Map<String, Any>>()

            try {
                while (cursor.moveToNext()) {
                    val download = cursor.download
                    result.add(getDownloadMap(download))
                }
            } finally {
                cursor.close()
            }
            return@AsyncFunction result
        }

        AsyncFunction("getDownloadStatusByIds") { ids: List<String> ->
            val context =
                appContext.reactContext ?: return@AsyncFunction emptyMap<String, Int>()
            val downloadManager = DownloadUtil.getDownloadManager(context)
            val downloadIndex = downloadManager.downloadIndex

            val result = mutableMapOf<String, Int>()

            for (id in ids) {
                val download = downloadIndex.getDownload(id)
                if (download != null) {
                    result[id] = download.state
                }
            }
            return@AsyncFunction result
        }

        AsyncFunction("clearUncompletedDownloadTasks") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            val downloadManager = DownloadUtil.getDownloadManager(context)
            val downloadIndex = downloadManager.downloadIndex

            val cursor = downloadIndex.getDownloads()
            try {
                while (cursor.moveToNext()) {
                    val download = cursor.download
                    if (download.state != Download.STATE_COMPLETED) {
                        DownloadService.sendRemoveDownload(
                            context,
                            OrpheusDownloadService::class.java,
                            download.request.id,
                            false
                        )
                    }
                }
            } finally {
                cursor.close()
            }
        }

        AsyncFunction("getUncompletedDownloadTasks") {
            val context =
                appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
            val downloadManager = DownloadUtil.getDownloadManager(context)
            val downloadIndex = downloadManager.downloadIndex

            val cursor = downloadIndex.getDownloads()
            val result = ArrayList<Map<String, Any>>()

            try {
                while (cursor.moveToNext()) {
                    val download = cursor.download
                    if (download.state != Download.STATE_COMPLETED) {
                        result.add(getDownloadMap(download))
                    }
                }
            } finally {
                cursor.close()
            }
            return@AsyncFunction result
        }

        AsyncFunction("checkOverlayPermission") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            android.provider.Settings.canDrawOverlays(context)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("requestOverlayPermission") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            if (!android.provider.Settings.canDrawOverlays(context)) {
                val intent = android.content.Intent(
                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    "package:${context.packageName}".toUri()
                )
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("showDesktopLyrics") {
            OrpheusMusicService.instance?.floatingLyricsManager?.show()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("hideDesktopLyrics") {
            OrpheusMusicService.instance?.floatingLyricsManager?.hide()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setDesktopLyrics") { lyricsJson: String ->
            try {
                val data = gson.fromJson(lyricsJson, expo.modules.orpheus.models.LyricsData::class.java)
                OrpheusMusicService.instance?.floatingLyricsManager?.setLyrics(data.lyrics, data.offset)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setPlaybackSpeed") { speed: Float ->
            checkPlayer()
            player?.setPlaybackSpeed(speed)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getPlaybackSpeed") {
            checkPlayer()
            player?.playbackParameters?.speed ?: 1.0f
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("debugTriggerError") {
            val rootCause = RuntimeException("This is a simulated root cause exception")
            val exception = PlaybackException(
                "Simulated PlaybackException for debugging",
                rootCause,
                PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
            )
            playerListener.onPlayerError(exception)
        }.runOnQueue(Queues.MAIN)
    }

    private fun getDownloadMap(download: Download): Map<String, Any> {
        val trackJson = if (download.request.data.isNotEmpty()) {
            String(download.request.data)
        } else null

        val map = mutableMapOf<String, Any>(
            "id" to download.request.id,
            "state" to download.state,
            "percentDownloaded" to download.percentDownloaded,
            "bytesDownloaded" to download.bytesDownloaded,
            "contentLength" to download.contentLength
        )

        if (trackJson != null) {
            try {
                val track = gson.fromJson(trackJson, TrackRecord::class.java)
                map["track"] = track
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return map
    }

    private val downloadListener = object : DownloadManager.Listener {
        override fun onDownloadChanged(
            downloadManager: DownloadManager,
            download: Download,
            finalException: Exception?
        ) {
            sendEvent("onDownloadUpdated", getDownloadMap(download))
            updateDownloadProgressRunnerState()
        }
    }

    private val downloadProgressRunnable = object : Runnable {
        override fun run() {
            val manager = downloadManager ?: return
            if (manager.currentDownloads.isNotEmpty()) {
                for (download in manager.currentDownloads) {
                    if (download.state == Download.STATE_DOWNLOADING) {
                        sendEvent("onDownloadUpdated", getDownloadMap(download))
                    }
                }
                mainHandler.postDelayed(this, 500)
            }
        }
    }

    private fun updateDownloadProgressRunnerState() {
        mainHandler.removeCallbacks(downloadProgressRunnable)
        val manager = downloadManager ?: return

        val hasActiveDownloads =
            manager.currentDownloads.any { it.state == Download.STATE_DOWNLOADING }

        if (hasActiveDownloads) {
            mainHandler.post(downloadProgressRunnable)
        }
    }

    private val progressSendEventRunnable = object : Runnable {
        override fun run() {
            val p = player ?: return

            if (p.isPlaying) {
                val currentMs = p.currentPosition
                val durationMs = p.duration

                sendEvent(
                    "onPositionUpdate", mapOf(
                        "position" to currentMs / 1000.0,
                        "duration" to if (durationMs == C.TIME_UNSET) 0.0 else durationMs / 1000.0,
                        "buffered" to p.bufferedPosition / 1000.0
                    )
                )
            }

            mainHandler.postDelayed(this, 200)
        }
    }

    private val progressSaveRunnable = object : Runnable {
        override fun run() {
            saveCurrentPosition()
            mainHandler.postDelayed(this, 5000)
        }
    }

    private fun updateProgressRunnerState() {
        val p = player
        // 如果正在播放且状态是 READY，则开始轮询
        if (p != null && p.isPlaying && p.playbackState == Player.STATE_READY) {
            mainHandler.removeCallbacks(progressSendEventRunnable)
            mainHandler.removeCallbacks(progressSaveRunnable)
            mainHandler.post(progressSaveRunnable)
            mainHandler.post(progressSendEventRunnable)
        } else {
            mainHandler.removeCallbacks(progressSendEventRunnable)
            mainHandler.removeCallbacks(progressSaveRunnable)
        }
    }

    private fun mediaItemToTrackRecord(item: MediaItem): TrackRecord {
        val extras = item.mediaMetadata.extras
        val trackJson = extras?.getString("track_json")

        if (trackJson != null) {
            try {
                return gson.fromJson(trackJson, TrackRecord::class.java)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        val track = TrackRecord()
        track.id = item.mediaId
        track.url = item.localConfiguration?.uri?.toString() ?: ""
        track.title = item.mediaMetadata.title?.toString()
        track.artist = item.mediaMetadata.artist?.toString()
        track.artwork = item.mediaMetadata.artworkUri?.toString()

        return track
    }

    private fun saveCurrentPosition() {
        val p = player ?: return
        if (p.playbackState != Player.STATE_IDLE) {
            GeneralStorage.savePosition(
                p.currentMediaItemIndex,
                p.currentPosition
            )
        }
    }

    private fun checkPlayer() {
        if (player == null) {
            throw ControllerNotInitializedException()
        }
    }
}