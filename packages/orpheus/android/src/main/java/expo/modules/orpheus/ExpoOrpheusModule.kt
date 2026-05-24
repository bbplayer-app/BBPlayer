package expo.modules.orpheus

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
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
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Float32Array
import expo.modules.orpheus.util.DirectoryPickerContract
import expo.modules.orpheus.exception.ControllerNotInitializedException
import expo.modules.orpheus.manager.CoverDownloadManager
import expo.modules.orpheus.manager.LyricsConsumer
import expo.modules.orpheus.manager.LyriconBackend
import expo.modules.orpheus.manager.SpectrumManager
import expo.modules.orpheus.model.TrackRecord
import expo.modules.orpheus.service.OrpheusDownloadService
import expo.modules.orpheus.service.OrpheusMusicService
import expo.modules.orpheus.util.DownloadUtil
import expo.modules.orpheus.util.ExportOptions
import expo.modules.orpheus.util.GeneralStorage
import expo.modules.orpheus.util.LoudnessStorage
import expo.modules.orpheus.util.runExportDownloads
import expo.modules.orpheus.util.toJsMap
import expo.modules.orpheus.util.toMediaItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@UnstableApi
class ExpoOrpheusModule : Module() {
    // keep this controller only to make sure MediaLibraryService is init.
    private var controllerFuture: ListenableFuture<MediaController>? = null

    private var player: Player? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    private var downloadManager: DownloadManager? = null

    private val spectrumManager = SpectrumManager()
    private var tempBuffer: FloatArray? = null

    private val ioScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // applicationContext 在 OnCreate 时缓存，生命周期与 Application 一致，
    // 不受 React Native 组件卸载导致 reactContext 变 null 的影响。
    private var cachedAppContext: Context? = null

    private lateinit var directoryPickerLauncher: AppContextActivityResultLauncher<String, String?>

    // 记录上一首歌曲的 ID，用于在切歌时发送给 JS
    private var lastMediaId: String? = null

    val json = Json { ignoreUnknownKeys = true }

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

            if (isPlaying) {
                player?.audioSessionId?.let { sessionId ->
                    if (sessionId != C.AUDIO_SESSION_ID_UNSET) {
                        spectrumManager.start(sessionId)
                    }
                }
            } else {
                spectrumManager.stop()
            }

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
            // Persistence is handled by ShuffleManager.setShuffleEnabled; nothing to do here.
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
            "onTrackFinished",
            "onCoverDownloadProgress",
            "onExportProgress",
            "onStatusBarLyricsStatusChanged",
            "onRequestClearLyrics"
        )

        RegisterActivityContracts {
            directoryPickerLauncher = registerForActivityResult(DirectoryPickerContract())
        }

        OnCreate {
            val context = appContext.reactContext ?: return@OnCreate
            cachedAppContext = context.applicationContext
            GeneralStorage.initialize(context)
            LoudnessStorage.initialize(context)
            expo.modules.orpheus.manager.CachedUriManager.initialize(context)
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

                    service.statusBarLyricsManager.setStatusChangeListener(object :
                        expo.modules.orpheus.manager.StatusBarLyricsManager.StatusChangeListener {
                        override fun onStatusChanged() {
                            sendEvent("onStatusBarLyricsStatusChanged", emptyMap<String, Any>())
                        }
                    })

                    service.addTrackEventListener(object : OrpheusMusicService.TrackEventListener {
                        override fun onTrackStarted(trackId: String, reason: Int) {
                            sendEvent(
                                "onTrackStarted", mapOf(
                                    "trackId" to trackId,
                                    "reason" to reason
                                )
                            )
                        }

                        override fun onTrackFinished(
                            trackId: String,
                            finalPosition: Double,
                            duration: Double
                        ) {
                            sendEvent(
                                "onTrackFinished", mapOf(
                                    "trackId" to trackId,
                                    "finalPosition" to finalPosition,
                                    "duration" to duration
                                )
                            )
                        }
                    })

                    service.addLyricEventListener(object : OrpheusMusicService.LyricEventListener {
                        override fun onLyricCleared(trackId: String) {
                            sendEvent(
                                "onRequestClearLyrics", mapOf(
                                    "trackId" to trackId
                                )
                            )
                        }
                    })
                }
            }

            downloadManager = DownloadUtil.getDownloadManager(context)
            downloadManager?.addListener(downloadListener)
        }

        OnDestroy {
            mainHandler.post {
                mainHandler.removeCallbacks(progressSendEventRunnable)
                mainHandler.removeCallbacks(progressSaveRunnable)
                mainHandler.removeCallbacks(downloadProgressRunnable)
                controllerFuture?.let { MediaController.releaseFuture(it) }
                downloadManager?.removeListener(downloadListener)
                player?.removeListener(playerListener)
                OrpheusMusicService.removeOnServiceReadyListener { }
                player = null
                spectrumManager.stop()
                ioScope.cancel()
                Log.d("Orpheus", "Destroy media controller")
            }
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
                GeneralStorage.setDesktopLyricsLocked(locked)
                mainHandler.post {
                    OrpheusMusicService.instance?.floatingLyricsManager?.setLocked(locked)
                }
            }

        Property("isStatusBarLyricsEnabled")
            .get { GeneralStorage.isStatusBarLyricsEnabled() }
            .set { enabled: Boolean ->
                GeneralStorage.setStatusBarLyricsEnabled(enabled)
                mainHandler.post {
                    OrpheusMusicService.instance?.statusBarLyricsManager?.enabled = enabled
                }
            }

        Property("isCarLyricsEnabled")
            .get { GeneralStorage.isCarLyricsEnabled() }
            .set { enabled: Boolean ->
                GeneralStorage.setCarLyricsEnabled(enabled)
                mainHandler.post {
                    OrpheusMusicService.instance?.setCarLyricsEnabled(enabled)
                }
            }

        Property("statusBarLyricsProvider")
            .get { GeneralStorage.getStatusBarLyricsProvider() }
            .set { provider: String ->
                // Lyricon requires API 27+; silently fall back to superlyric on older devices
                // so the persisted value always reflects what is actually used.
                val effective = if (provider == "lyricon" && Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
                    "superlyric"
                } else {
                    provider
                }
                GeneralStorage.setStatusBarLyricsProvider(effective)
                mainHandler.post {
                    GeneralStorage.setStatusBarLyricsProvider(effective)
                    val service = OrpheusMusicService.instance ?: return@post
                    service.statusBarLyricsManager.backend = service.createStatusBarBackend(effective)
                }
            }

        Property("isSuperLyricApiEnabled")
            .get { com.hchen.superlyricapi.SuperLyricTool.isEnabled }

        Property("isLyriconApiEnabled")
            .get {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return@get false
                OrpheusMusicService.instance?.statusBarLyricsManager?.backend
                    ?.let { it is LyriconBackend && it.isAvailable }
                    ?: false
            }

        Property("isMeizuStatusBarLyricsApiEnabled")
            .get { true }


        Function("setBilibiliCookie") { cookie: String ->
            OrpheusConfig.bilibiliCookie = cookie
        }

        AsyncFunction("getPosition") Coroutine { ->
            withPlayerOnMainThread { it.currentPosition.toDouble() / 1000.0 }
        }

        AsyncFunction("getDuration") Coroutine { ->
            val d = withPlayerOnMainThread { it.duration }
            if (d == C.TIME_UNSET) 0.0 else d.toDouble() / 1000.0
        }

        AsyncFunction("getBuffered") Coroutine { ->
            withPlayerOnMainThread { it.bufferedPosition.toDouble() / 1000.0 }
        }

        AsyncFunction("getIsPlaying") Coroutine { ->
            withPlayerOnMainThread { it.isPlaying }
        }

        AsyncFunction("getCurrentIndex") Coroutine { ->
            withPlayerOnMainThread { it.currentMediaItemIndex }
        }

        AsyncFunction("getCurrentTrack") Coroutine { ->
            val currentItem = withPlayerOnMainThread { it.currentMediaItem } ?: return@Coroutine null

            mediaItemToTrackRecord(currentItem)
        }

        AsyncFunction("getShuffleMode") {
            // Read from persisted state (managed by ShuffleManager).
            GeneralStorage.getShuffleMode()
        }

        AsyncFunction("getIndexTrack") Coroutine { index: Int ->
            val item = withPlayerOnMainThread { currentPlayer ->
                if (index < 0 || index >= currentPlayer.mediaItemCount) {
                    return@withPlayerOnMainThread null
                }

                currentPlayer.getMediaItemAt(index)
            }
                ?: return@Coroutine null

            mediaItemToTrackRecord(item)
        }

        AsyncFunction("play") Coroutine { ->
            withPlayerOnMainThread { currentPlayer ->
                if (currentPlayer.playbackState == Player.STATE_ENDED) {
                    currentPlayer.seekTo(0)
                }
                prepareIfIdle(currentPlayer)
                currentPlayer.play()
            }
        }

        AsyncFunction("pause") Coroutine { ->
            withPlayerOnMainThread { it.pause() }
        }

        AsyncFunction("clear") Coroutine { ->
            withPlayerOnMainThread { it.clearMediaItems() }
        }

        AsyncFunction("skipTo") Coroutine { index: Int ->
            // 跳转到指定索引的开头
            // When shuffle is enabled, `index` is the position in the shuffle-traversal
            // order (as returned by getQueue). Convert to the physical queue index first.
            withServiceAndPlayerOnMainThread { service, currentPlayer ->
                if (service.shuffleManager.isEnabled) {
                    val order = service.shuffleManager.getTraversalOrder()
                    val physicalIndex = order?.getOrElse(index) { C.INDEX_UNSET } ?: C.INDEX_UNSET
                    if (physicalIndex != C.INDEX_UNSET) {
                        currentPlayer.seekTo(physicalIndex, C.TIME_UNSET)
                    } else {
                        return@withServiceAndPlayerOnMainThread
                    }
                } else {
                    currentPlayer.seekTo(index, C.TIME_UNSET)
                }
                prepareIfIdle(currentPlayer)
            }
        }

        AsyncFunction("skipToNext") Coroutine { ->
            withPlayerOnMainThread { currentPlayer ->
                // When in REPEAT_MODE_ONE, always allow next - wrap around if at the end
                val mediaItemCount = currentPlayer.mediaItemCount
                if (currentPlayer.repeatMode == Player.REPEAT_MODE_ONE
                    && mediaItemCount > 0
                    && !currentPlayer.hasNextMediaItem()
                ) {
                    currentPlayer.seekTo(0, C.TIME_UNSET)
                    prepareIfIdle(currentPlayer)
                    return@withPlayerOnMainThread
                }

                if (currentPlayer.hasNextMediaItem()) {
                    currentPlayer.seekToNext()
                    prepareIfIdle(currentPlayer)
                }
            }
        }

        AsyncFunction("skipToPrevious") Coroutine { ->
            withPlayerOnMainThread { currentPlayer ->
                // When in REPEAT_MODE_ONE, always allow previous - wrap around if at the beginning
                val mediaItemCount = currentPlayer.mediaItemCount
                if (currentPlayer.repeatMode == Player.REPEAT_MODE_ONE
                    && mediaItemCount > 0
                    && !currentPlayer.hasPreviousMediaItem()
                ) {
                    currentPlayer.seekTo(mediaItemCount - 1, C.TIME_UNSET)
                    prepareIfIdle(currentPlayer)
                    return@withPlayerOnMainThread
                }

                if (currentPlayer.hasPreviousMediaItem()) {
                    currentPlayer.seekToPreviousMediaItem()
                    prepareIfIdle(currentPlayer)
                }
            }
        }

        AsyncFunction("seekTo") Coroutine { seconds: Double ->
            val ms = (seconds * 1000).toLong()
            withPlayerOnMainThread { it.seekTo(ms) }
        }

        AsyncFunction("setRepeatMode") Coroutine { mode: Int ->
            // mode: 0=OFF, 1=TRACK, 2=QUEUE
            val repeatMode = when (mode) {
                1 -> Player.REPEAT_MODE_ONE
                2 -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
            withPlayerOnMainThread { it.repeatMode = repeatMode }
        }

        AsyncFunction("setShuffleMode") Coroutine { enabled: Boolean ->
            // Delegate to the service's ShuffleManager which uses Media3's built-in
            // shuffleModeEnabled for O(1) shuffle toggle without physical queue reordering.
            withServiceOnMainThread { service ->
                if (service != null) {
                    service.applyShuffleMode(enabled)
                } else {
                    // Service not yet bound — persist the preference for restorePlayerState to pick up
                    GeneralStorage.saveShuffleMode(enabled)
                }
            }
        }

        AsyncFunction("getRepeatMode") Coroutine { ->
            withPlayerOnMainThread { it.repeatMode }
        }

        AsyncFunction("removeTrack") Coroutine { index: Int ->
            withServiceAndPlayerOnMainThread { service, currentPlayer ->
                if (service.shuffleManager.isEnabled) {
                    // index is the shuffle-traversal position; resolve to physical index.
                    val order = service.shuffleManager.getTraversalOrder()
                    val physicalIndex = order?.getOrElse(index) { -1 } ?: -1
                    if (physicalIndex >= 0 && physicalIndex < currentPlayer.mediaItemCount) {
                        currentPlayer.removeMediaItem(physicalIndex)
                    }
                } else {
                    if (index >= 0 && index < currentPlayer.mediaItemCount) {
                        currentPlayer.removeMediaItem(index)
                    }
                }
            }
        }

        AsyncFunction("getQueue") Coroutine { ->
            val items = withServiceAndPlayerOnMainThread { service, currentPlayer ->
                // When shuffle is enabled, return items in the logical playback (shuffle traversal)
                // order so the UI displays what will actually be played next.
                val traversal = if (service.shuffleManager.isEnabled) {
                    service.shuffleManager.getTraversalOrder()
                } else {
                    null
                }

                if (traversal != null) {
                    traversal.map { physicalIdx -> currentPlayer.getMediaItemAt(physicalIdx) }
                } else {
                    List(currentPlayer.mediaItemCount) { index -> currentPlayer.getMediaItemAt(index) }
                }
            }

            items.map(::mediaItemToTrackRecord)
        }

        AsyncFunction("setSleepTimer") { durationMs: Long ->
            OrpheusMusicService.instance?.startSleepTimer(durationMs)
            return@AsyncFunction null
        }

        AsyncFunction("getSleepTimerEndTime") {
            return@AsyncFunction OrpheusMusicService.instance?.getSleepTimerRemaining()
        }

        AsyncFunction("cancelSleepTimer") {
            OrpheusMusicService.instance?.cancelSleepTimer()
            return@AsyncFunction null
        }

        AsyncFunction("addToEnd") Coroutine { tracks: List<TrackRecord>, startFromId: String?, clearQueue: Boolean? ->
            val context = appContext.reactContext
            val mediaItems = tracks.map { track ->
                track.toMediaItem(context)
            }
            withPlayerOnMainThread { currentPlayer ->
                if (clearQueue == true) {
                    currentPlayer.clearMediaItems()
                }
                val initialSize = currentPlayer.mediaItemCount
                currentPlayer.addMediaItems(mediaItems)

                if (!startFromId.isNullOrEmpty()) {
                    val relativeIndex = tracks.indexOfFirst { it.id == startFromId }

                    if (relativeIndex != -1) {
                        val targetIndex = initialSize + relativeIndex

                        currentPlayer.seekTo(targetIndex, C.TIME_UNSET)
                        currentPlayer.prepare()
                        currentPlayer.play()

                        return@withPlayerOnMainThread
                    }
                }

                if (currentPlayer.playbackState == Player.STATE_IDLE) {
                    currentPlayer.prepare()
                }
            }
        }

        AsyncFunction("playNext") Coroutine { track: TrackRecord ->
            val context = appContext.reactContext
            val mediaItem = track.toMediaItem(context)
            withServiceAndPlayerOnMainThread { service, currentPlayer ->
                val shuffleEnabled = service.shuffleManager.isEnabled

                var existingIndex = -1
                for (i in 0 until currentPlayer.mediaItemCount) {
                    if (currentPlayer.getMediaItemAt(i).mediaId == track.id) {
                        existingIndex = i
                        break
                    }
                }

                if (existingIndex != -1) {
                    if (existingIndex == currentPlayer.currentMediaItemIndex) {
                        return@withServiceAndPlayerOnMainThread
                    }
                    if (shuffleEnabled) {
                        // Remove the existing instance then re-add right after the current item.
                        // Using remove+add (rather than moveMediaItem) keeps the physical insertion
                        // index deterministic: after removing existingIndex, currentMediaItemIndex
                        // is automatically adjusted, so +1 always points to the correct next slot.
                        currentPlayer.removeMediaItem(existingIndex)
                        val insertPhysical =
                            (currentPlayer.currentMediaItemIndex + 1).coerceAtMost(currentPlayer.mediaItemCount)
                        currentPlayer.addMediaItem(insertPhysical, mediaItem)
                        service.shuffleManager.repositionAsNext(insertPhysical)
                    } else {
                        val targetIndex = currentPlayer.currentMediaItemIndex + 1
                        val safeTargetIndex = targetIndex.coerceAtMost(currentPlayer.mediaItemCount)
                        currentPlayer.moveMediaItem(existingIndex, safeTargetIndex)
                    }
                } else {
                    val targetIndex = currentPlayer.currentMediaItemIndex + 1
                    val safeTargetIndex = targetIndex.coerceAtMost(currentPlayer.mediaItemCount)
                    currentPlayer.addMediaItem(safeTargetIndex, mediaItem)
                    if (shuffleEnabled) {
                        service.shuffleManager.repositionAsNext(safeTargetIndex)
                    }
                }

                if (currentPlayer.playbackState == Player.STATE_IDLE) {
                    currentPlayer.prepare()
                }
            }
        }

        AsyncFunction("downloadTrack") { track: TrackRecord ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val downloadRequest = DownloadRequest.Builder(track.id, track.url.toUri())
                .setData(json.encodeToString(track).toByteArray())
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
                    .setData(json.encodeToString(track).toByteArray())
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

        AsyncFunction("resumeDownload") { id: String ->
            val context = appContext.reactContext ?: return@AsyncFunction
            DownloadService.sendSetStopReason(
                context,
                OrpheusDownloadService::class.java,
                id,
                Download.STOP_REASON_NONE,
                false
            )
        }

        AsyncFunction("retryDownload") { track: TrackRecord ->
            val context = appContext.reactContext ?: return@AsyncFunction
            val downloadRequest = DownloadRequest.Builder(track.id, track.url.toUri())
                .setData(json.encodeToString(track).toByteArray())
                .build()
            DownloadService.sendAddDownload(
                context,
                OrpheusDownloadService::class.java,
                downloadRequest,
                false
            )
        }

        AsyncFunction("setDownloadMaxParallelTasks") { maxParallelTasks: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction
            DownloadUtil.setMaxParallelDownloads(context, maxParallelTasks)
        }

        AsyncFunction("removeDownload") { id: String ->
            val context = appContext.reactContext ?: return@AsyncFunction
            DownloadService.sendRemoveDownload(
                context,
                OrpheusDownloadService::class.java,
                id,
                false
            )
            CoverDownloadManager.deleteCover(context, id)
        }

        AsyncFunction("removeDownloads") { ids: List<String> ->
            val context = appContext.reactContext ?: return@AsyncFunction
            for (id in ids) {
                DownloadService.sendRemoveDownload(
                    context,
                    OrpheusDownloadService::class.java,
                    id,
                    false
                )
                CoverDownloadManager.deleteCover(context, id)
            }
        }

        AsyncFunction("removeAllDownloads") {
            val context = appContext.reactContext ?: return@AsyncFunction null
            DownloadService.sendRemoveAllDownloads(
                context,
                OrpheusDownloadService::class.java,
                false
            )
            CoverDownloadManager.deleteAllCovers(context)
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

        AsyncFunction("downloadMissingCovers") {
            val context =
                appContext.reactContext ?: return@AsyncFunction 0
            val downloadManager = DownloadUtil.getDownloadManager(context)
            val downloadIndex = downloadManager.downloadIndex
            val cursor = downloadIndex.getDownloads()

            // 先收集所有待下载项
            data class PendingCover(val trackId: String, val artworkUrl: String)

            val pendingList = mutableListOf<PendingCover>()

            try {
                while (cursor.moveToNext()) {
                    val download = cursor.download
                    if (download.state != Download.STATE_COMPLETED) continue
                    if (download.request.data.isEmpty()) continue

                    val trackId = download.request.id
                    if (CoverDownloadManager.getCoverFile(context, trackId) != null) continue

                    try {
                        val track = json.decodeFromString<TrackRecord>(
                            String(download.request.data)
                        )
                        val artwork = track.artwork
                        if (!artwork.isNullOrEmpty()) {
                            pendingList.add(PendingCover(trackId, artwork))
                        }
                    } catch (e: Exception) {
                        Log.e("Orpheus", "Failed to parse track for cover: ${e.message}")
                    }
                }
            } finally {
                cursor.close()
            }

            val total = pendingList.size
            if (total == 0) return@AsyncFunction 0

            // 在 IO 线程顺序下载，逐个发送进度事件
            ioScope.launch {
                pendingList.forEachIndexed { index, item ->
                    val status = try {
                        CoverDownloadManager.downloadCover(context, item.trackId, item.artworkUrl)
                        "success"
                    } catch (e: Exception) {
                        Log.e("Orpheus", "Cover download failed for ${item.trackId}: ${e.message}")
                        "failed"
                    }
                    sendEvent(
                        "onCoverDownloadProgress", mapOf(
                            "current" to (index + 1),
                            "total" to total,
                            "trackId" to item.trackId,
                            "status" to status
                        )
                    )
                }
            }

            return@AsyncFunction total
        }

        AsyncFunction("exportDownloads") { ids: List<String>, destinationUri: String, filenamePattern: String?, embedLyrics: Boolean, convertToLrc: Boolean, cropCoverArt: Boolean ->
            val context = appContext.reactContext ?: run {
                sendEvent(
                    "onExportProgress", mapOf(
                        "status" to "error",
                        "message" to "React context is null"
                    )
                )
                return@AsyncFunction
            }
            runExportDownloads(
                ids = ids,
                destinationUri = destinationUri,
                context = context,
                options = ExportOptions(
                    filenamePattern = filenamePattern,
                    embedLyrics = embedLyrics,
                    convertToLrc = convertToLrc,
                    cropCoverArt = cropCoverArt,
                ),
                json = json,
                ioScope = ioScope,
                sendEvent = ::sendEvent,
            )
        }

        Function("getDownloadedCoverUri") { trackId: String ->
            val context = appContext.reactContext ?: return@Function null
            val file = CoverDownloadManager.getCoverFile(context, trackId)
            file?.let { "file://${it.absolutePath}" }
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
        }

        AsyncFunction("requestOverlayPermission") Coroutine { ->
            val context = appContext.reactContext ?: return@Coroutine false
            withContext(Dispatchers.Main.immediate) {
                if (!android.provider.Settings.canDrawOverlays(context)) {
                    val intent = android.content.Intent(
                        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        "package:${context.packageName}".toUri()
                    )
                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                }
            }
        }

        AsyncFunction("showDesktopLyrics") Coroutine { ->
            withServiceOnMainThread { it?.floatingLyricsManager?.show() }
        }

        AsyncFunction("hideDesktopLyrics") Coroutine { ->
            withServiceOnMainThread { it?.floatingLyricsManager?.hide() }
        }

        AsyncFunction("setLyricsInternal") Coroutine { lyricsJson: String, consumerIds: List<String> ->
            submitLyricsInternal(lyricsJson, resolveLyricsConsumers(consumerIds))
        }

        AsyncFunction("clearOverlays") Coroutine { ->
            // 无歌词时临时隐藏 overlay，但不修改 GeneralStorage（用户偏好保持 true）
            // 当再次收到歌词时，桌面歌词会按用户偏好重新 show()
            withServiceOnMainThread { service ->
                service?.lyricsManager?.clearConsumers(LyricsConsumer.all(), softHideDesktop = true)
            }
        }

        AsyncFunction("setPlaybackSpeed") Coroutine { speed: Float ->
            withPlayerOnMainThread { it.setPlaybackSpeed(speed) }
        }

        AsyncFunction("selectDirectory") Coroutine { ->
            val context = appContext.reactContext ?: return@Coroutine null
            val uriString = try {
                directoryPickerLauncher.launch("")
            } catch (e: Exception) {
                Log.e("Orpheus", "Directory picker launch failed (framework race condition): ${e.message}")
                null
            }
            if (uriString != null) {
                try {
                    val treeUri = uriString.toUri()
                    context.contentResolver.takePersistableUriPermission(
                        treeUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    )
                } catch (e: Exception) {
                    Log.e("Orpheus", "Failed to take persistable URI permission: ${e.message}")
                }
            }
            uriString
        }

        AsyncFunction("isDirectoryPickerAvailable") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).resolveActivity(context.packageManager) != null
        }

        AsyncFunction("getPlaybackSpeed") Coroutine { ->
            withPlayerOnMainThread { it.playbackParameters.speed }
        }

        Function("getLruCachedUris") { uris: List<String> ->
            try {
                uris.filter { uri ->
                    expo.modules.orpheus.manager.CachedUriManager.isFullyCached(uri)
                }
            } catch (e: Exception) {
                emptyList<String>()
            }
        }

        Function("updateSpectrumData") { destination: Float32Array ->
            val size = destination.length
            if (tempBuffer == null || tempBuffer!!.size != size) {
                tempBuffer = FloatArray(size)
            }
            val buffer = tempBuffer!!
            spectrumManager.getSpectrumData(buffer)

            val byteBuffer = destination.toDirectBuffer()
            byteBuffer.order(java.nio.ByteOrder.nativeOrder())
            byteBuffer.asFloatBuffer().put(buffer)
        }
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
                val track = json.decodeFromString<TrackRecord>(trackJson)
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

            // 歌曲下载完成后，异步下载封面
            if (download.state == Download.STATE_COMPLETED && download.request.data.isNotEmpty()) {
                // 封面下载只需能访问文件系统的 Context，使用 OnCreate 时缓存的
                // applicationContext，避免 reactContext 为 null 时封面静默跳过。
                val context = cachedAppContext ?: appContext.reactContext ?: return
                try {
                    val track = json.decodeFromString<TrackRecord>(
                        String(download.request.data)
                    )
                    val artwork = track.artwork
                    if (!artwork.isNullOrEmpty()) {
                        ioScope.launch {
                            CoverDownloadManager.downloadCover(context, track.id, artwork)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("Orpheus", "Failed to trigger cover download: ${e.message}")
                }
            }
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
                return json.decodeFromString(trackJson)
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

    private fun ensurePlayer() {
        val service = OrpheusMusicService.instance
            ?: throw ControllerNotInitializedException()
        val servicePlayer = service.ensurePlayer()
        if (this.player !== servicePlayer) {
            this.player?.removeListener(playerListener)
            this.player = servicePlayer
            servicePlayer.addListener(playerListener)
        }
    }

    private fun prepareIfIdle(player: Player) {
        if (player.playbackState == Player.STATE_IDLE && player.mediaItemCount > 0) {
            player.prepare()
        }
    }

    private suspend fun <T> withPlayerOnMainThread(block: (Player) -> T): T =
        withContext(Dispatchers.Main.immediate) {
            ensurePlayer()
            val currentPlayer = player ?: throw ControllerNotInitializedException()
            block(currentPlayer)
        }

    private suspend fun <T> withServiceAndPlayerOnMainThread(block: (OrpheusMusicService, Player) -> T): T =
        withContext(Dispatchers.Main.immediate) {
            ensurePlayer()
            val service = OrpheusMusicService.instance ?: throw ControllerNotInitializedException()
            val currentPlayer = player ?: throw ControllerNotInitializedException()
            block(service, currentPlayer)
        }

    private suspend fun <T> withServiceOnMainThread(block: (OrpheusMusicService?) -> T): T =
        withContext(Dispatchers.Main.immediate) {
            block(OrpheusMusicService.instance)
        }

    private suspend fun submitLyricsInternal(
        lyricsJson: String,
        consumers: Set<LyricsConsumer>,
    ) {
        try {
            val data = json.decodeFromString<expo.modules.orpheus.model.LyricsData>(lyricsJson)
            withServiceOnMainThread { service ->
                service?.lyricsManager?.submitLyrics(data, consumers)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(
                "OrpheusLyrics",
                "[Module] submitLyrics failed consumers=${consumers.joinToString()} reason=${e.message}",
                e,
            )
        }
    }

    private fun resolveLyricsConsumers(consumerIds: List<String>): Set<LyricsConsumer> {
        if (consumerIds.isEmpty()) return LyricsConsumer.all()

        val resolved = consumerIds.mapNotNull { LyricsConsumer.fromIdentifier(it) }.toSet()
        if (resolved.isEmpty()) {
            Log.w("OrpheusLyrics", "[Module] No valid consumers resolved from $consumerIds")
        }
        return resolved
    }
}
