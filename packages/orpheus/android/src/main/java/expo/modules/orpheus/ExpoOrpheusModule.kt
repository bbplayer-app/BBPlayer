package expo.modules.orpheus

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
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
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Float32Array
import expo.modules.orpheus.util.DirectoryPickerContract
import expo.modules.orpheus.exception.ControllerNotInitializedException
import expo.modules.orpheus.manager.CoverDownloadManager
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
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
            "onTrackFinished",
            "onCoverDownloadProgress",
            "onExportProgress"
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
                mainHandler.post {
                    OrpheusMusicService.instance?.floatingLyricsManager?.setLocked(locked)
                }
            }


        Function("setBilibiliCookie") { cookie: String ->
            OrpheusConfig.bilibiliCookie = cookie
        }

        AsyncFunction("getPosition") {
            ensurePlayer()
            player?.currentPosition?.toDouble()?.div(1000.0) ?: 0.0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getDuration") {
            ensurePlayer()
            val d = player?.duration ?: C.TIME_UNSET
            if (d == C.TIME_UNSET) 0.0 else d.toDouble() / 1000.0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getBuffered") {
            ensurePlayer()
            player?.bufferedPosition?.toDouble()?.div(1000.0) ?: 0.0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getIsPlaying") {
            ensurePlayer()
            player?.isPlaying ?: false
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getCurrentIndex") {
            ensurePlayer()
            player?.currentMediaItemIndex ?: -1
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getCurrentTrack") {
            ensurePlayer()
            val p = player ?: return@AsyncFunction null
            val currentItem = p.currentMediaItem ?: return@AsyncFunction null

            mediaItemToTrackRecord(currentItem)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getShuffleMode") {
            ensurePlayer()
            player?.shuffleModeEnabled
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getIndexTrack") { index: Int ->
            ensurePlayer()
            val p = player ?: return@AsyncFunction null

            if (index < 0 || index >= p.mediaItemCount) {
                return@AsyncFunction null
            }

            val item = p.getMediaItemAt(index)

            mediaItemToTrackRecord(item)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("play") {
            ensurePlayer()
            val p = player ?: return@AsyncFunction null
            if (p.playbackState == Player.STATE_ENDED) {
                p.seekTo(0)
            }
            p.play()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("pause") {
            ensurePlayer()
            player?.pause()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("clear") {
            ensurePlayer()
            player?.clearMediaItems()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("skipTo") { index: Int ->
            // 跳转到指定索引的开头
            ensurePlayer()
            player?.seekTo(index, C.TIME_UNSET)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("skipToNext") {
            ensurePlayer()

            // When in REPEAT_MODE_ONE, always allow next - wrap around if at the end
            val mediaItemCount = player?.mediaItemCount ?: 0
            if (player?.repeatMode == Player.REPEAT_MODE_ONE
                && mediaItemCount > 0
                && !(player?.hasNextMediaItem() ?: false)
            ) {
                player?.seekTo(0, C.TIME_UNSET)
                return@AsyncFunction Unit
            }

            if (player?.hasNextMediaItem() == true) {
                player?.seekToNext()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("skipToPrevious") {
            ensurePlayer()
            val p = player ?: return@AsyncFunction null

            // When in REPEAT_MODE_ONE, always allow previous - wrap around if at the beginning
            val mediaItemCount = player?.mediaItemCount ?: 0
            if (player?.repeatMode == Player.REPEAT_MODE_ONE
                && mediaItemCount > 0
                && !p.hasPreviousMediaItem()
            ) {
                p.seekTo(mediaItemCount - 1, C.TIME_UNSET)
                return@AsyncFunction Unit
            }

            if (p.hasPreviousMediaItem()) {
                p.seekToPreviousMediaItem()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("seekTo") { seconds: Double ->
            ensurePlayer()
            val ms = (seconds * 1000).toLong()
            player?.seekTo(ms)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setRepeatMode") { mode: Int ->
            ensurePlayer()
            // mode: 0=OFF, 1=TRACK, 2=QUEUE
            val repeatMode = when (mode) {
                1 -> Player.REPEAT_MODE_ONE
                2 -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
            player?.repeatMode = repeatMode
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setShuffleMode") { enabled: Boolean ->
            ensurePlayer()
            player?.shuffleModeEnabled = enabled
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getRepeatMode") {
            ensurePlayer()
            player?.repeatMode
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("removeTrack") { index: Int ->
            ensurePlayer()
            if (index >= 0 && index < (player?.mediaItemCount ?: 0)) {
                player?.removeMediaItem(index)
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getQueue") {
            ensurePlayer()
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
            ensurePlayer()
            val context = appContext.reactContext
            val mediaItems = tracks.map { track ->
                track.toMediaItem(context)
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
            ensurePlayer()
            val p = player ?: return@AsyncFunction

            val context = appContext.reactContext
            val mediaItem = track.toMediaItem(context)
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
            val context = appContext.reactContext ?: return@AsyncFunction
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
                val data = json.decodeFromString<expo.modules.orpheus.model.LyricsData>(lyricsJson)
                OrpheusMusicService.instance?.floatingLyricsManager?.setLyrics(
                    data.lyrics,
                    data.offset
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setPlaybackSpeed") { speed: Float ->
            ensurePlayer()
            player?.setPlaybackSpeed(speed)
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("selectDirectory") Coroutine { ->
            val context = appContext.reactContext ?: return@Coroutine null
            val uriString = directoryPickerLauncher.launch("")
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

        AsyncFunction("getPlaybackSpeed") {
            ensurePlayer()
            player?.playbackParameters?.speed ?: 1.0f
        }.runOnQueue(Queues.MAIN)

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
}