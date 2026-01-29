package expo.modules.orpheus

import android.app.PendingIntent
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.net.toUri
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.CopyOnWriteArrayList
import expo.modules.orpheus.R
import expo.modules.orpheus.utils.DownloadUtil
import expo.modules.orpheus.utils.SleepTimeController
import expo.modules.orpheus.utils.GeneralStorage
import expo.modules.orpheus.utils.GlideBitmapLoader
import expo.modules.orpheus.utils.LoudnessStorage
import expo.modules.orpheus.utils.calculateLoudnessGain
import expo.modules.orpheus.utils.fadeInTo
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.abs

class OrpheusMusicService : MediaLibraryService() {

    var player: ExoPlayer? = null
    private var mediaSession: MediaLibrarySession? = null
    private var sleepTimerManager: SleepTimeController? = null
    private var volumeFadeJob: Job? = null
    private var scope = MainScope()

    lateinit var floatingLyricsManager: FloatingLyricsManager
    private val serviceHandler = android.os.Handler(android.os.Looper.getMainLooper())
    
    private var lastTrackFinishedAt: Long = 0
    private val durationCache = mutableMapOf<String, Long>()

    private val lyricsUpdateRunnable = object : Runnable {
        override fun run() {
            player?.let {
                if (it.isPlaying) {
                    floatingLyricsManager.updateTime(it.currentPosition / 1000.0)
                }
            }
            serviceHandler.postDelayed(this, 200)
        }
    }

    companion object {
        var instance: OrpheusMusicService? = null
            private set(value) {
                field = value
                if (value != null) {
                    listeners.forEach { it(value) }
                }
            }

        private val listeners = CopyOnWriteArrayList<(OrpheusMusicService) -> Unit>()

        fun addOnServiceReadyListener(listener: (OrpheusMusicService) -> Unit) {
            instance?.let { listener(it) }
            listeners.add(listener)
        }

        fun removeOnServiceReadyListener(listener: (OrpheusMusicService) -> Unit) {
            listeners.remove(listener)
        }
    }

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        instance = this

        GeneralStorage.initialize(this)
        LoudnessStorage.initialize(this)

        setMediaNotificationProvider(object : DefaultMediaNotificationProvider(this) {
            override fun getMediaButtons(
                session: MediaSession,
                playerCommands: Player.Commands,
                customLayout: ImmutableList<CommandButton>,
                showPlaying: Boolean
            ): ImmutableList<CommandButton> {
                val builder = ImmutableList.builder<CommandButton>()
                val player = session.player

                // Previous
                builder.add(
                    CommandButton.Builder(CommandButton.ICON_UNDEFINED)
                        .setPlayerCommand(Player.COMMAND_SEEK_TO_PREVIOUS)
                        .setCustomIconResId(R.drawable.outline_skip_previous_24)
                        .setDisplayName("Previous")
                        .setEnabled(playerCommands.contains(Player.COMMAND_SEEK_TO_PREVIOUS))
                        .build()
                )

                // Play/Pause
                if (showPlaying) {
                    builder.add(
                        CommandButton.Builder(CommandButton.ICON_UNDEFINED)
                            .setPlayerCommand(Player.COMMAND_PLAY_PAUSE)
                            .setCustomIconResId(R.drawable.outline_pause_24)
                            .setDisplayName("Pause")
                            .setEnabled(playerCommands.contains(Player.COMMAND_PLAY_PAUSE))
                            .build()
                    )
                } else {
                    builder.add(
                        CommandButton.Builder(CommandButton.ICON_UNDEFINED)
                            .setPlayerCommand(Player.COMMAND_PLAY_PAUSE)
                            .setCustomIconResId(R.drawable.outline_play_arrow_24)
                            .setDisplayName("Play")
                            .setEnabled(playerCommands.contains(Player.COMMAND_PLAY_PAUSE))
                            .build()
                    )
                }

                // Next
                builder.add(
                    CommandButton.Builder(CommandButton.ICON_UNDEFINED)
                        .setPlayerCommand(Player.COMMAND_SEEK_TO_NEXT)
                        .setCustomIconResId(R.drawable.outline_skip_next_24)
                        .setDisplayName("Next")
                        .setEnabled(playerCommands.contains(Player.COMMAND_SEEK_TO_NEXT))
                        .build()
                )

                // Repeat Mode Toggle
                val repeatIcon = when (player.repeatMode) {
                    Player.REPEAT_MODE_ONE -> R.drawable.outline_repeat_one_24
                    Player.REPEAT_MODE_ALL -> R.drawable.outline_repeat_24
                    else -> R.drawable.outline_repeat_off_24
                }

                builder.add(
                    CommandButton.Builder(CommandButton.ICON_UNDEFINED)
                        .setSessionCommand(SessionCommand(CustomCommands.CMD_TOGGLE_REPEAT_MODE, Bundle.EMPTY))
                        .setCustomIconResId(repeatIcon)
                        .setDisplayName("Repeat Mode")
                        .setEnabled(true)
                        .build()
                )

                return builder.build()
            }
        })


        val dataSourceFactory = DownloadUtil.getPlayerDataSourceFactory(this)

        val mediaSourceFactory = DefaultMediaSourceFactory(this)
            .setDataSourceFactory(dataSourceFactory)


        val renderersFactory = DefaultRenderersFactory(this)
            .experimentalSetMediaCodecAsyncCryptoFlagEnabled(false)

        player = ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(mediaSourceFactory)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .build()

        floatingLyricsManager = FloatingLyricsManager(this, player)
        if (GeneralStorage.isDesktopLyricsShown()) {
            serviceHandler.post { floatingLyricsManager.show() }
        }

        setupListeners()

        var launchIntent = packageManager.getLaunchIntentForPackage(packageName)

        if (launchIntent == null) {
            launchIntent = Intent().apply {
                setClassName(packageName, "$packageName.MainActivity")
            }
        }

        launchIntent.apply {
            action = Intent.ACTION_VIEW
            data = "orpheus://player".toUri()
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val contentIntent = launchIntent.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        mediaSession = MediaLibrarySession.Builder(this, player!!, callback)
            .setId("OrpheusSession")
            .setSessionActivity(contentIntent)
            .setBitmapLoader(GlideBitmapLoader(this))
            .build()

        restorePlayerState(GeneralStorage.isRestoreEnabled())
        sleepTimerManager = SleepTimeController(player!!)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? {
        return mediaSession
    }

    override fun onDestroy() {
        serviceHandler.removeCallbacks(lyricsUpdateRunnable)
        floatingLyricsManager.hide()
        scope.cancel()
        instance = null

        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }

    fun startSleepTimer(durationMs: Long) {
        sleepTimerManager?.start(durationMs)
    }

    fun cancelSleepTimer() {
        sleepTimerManager?.cancel()
    }

    fun getSleepTimerRemaining(): Long? {
        return sleepTimerManager?.getStopTimeMs()
    }

    var callback: MediaLibrarySession.Callback = @UnstableApi
    object : MediaLibrarySession.Callback {

        @OptIn(UnstableApi::class)
        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo
        ): MediaSession.ConnectionResult {
            val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
                .add(SessionCommand(CustomCommands.CMD_TOGGLE_REPEAT_MODE, Bundle.EMPTY))
                .build()

            return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                .setAvailableSessionCommands(sessionCommands)
                .build()
        }

        @OptIn(UnstableApi::class)
        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle
        ): ListenableFuture<SessionResult> {
            if (customCommand.customAction == CustomCommands.CMD_TOGGLE_REPEAT_MODE) {
                val player = session.player
                val newMode = when (player.repeatMode) {
                    Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                    Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                    Player.REPEAT_MODE_ONE -> Player.REPEAT_MODE_OFF
                    else -> Player.REPEAT_MODE_OFF
                }
                player.repeatMode = newMode
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            }
            return super.onCustomCommand(session, controller, customCommand, args)
        }

        override fun onPlaybackResumption(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            isPlayback: Boolean
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            return Futures.immediateFuture(
                MediaSession.MediaItemsWithStartPosition(
                    emptyList(), // 没有媒体项
                    C.INDEX_UNSET, // 索引未定
                    C.TIME_UNSET   // 进度未定
                )
            )
        }
    }

    @OptIn(UnstableApi::class)
    private fun restorePlayerState(restorePosition: Boolean) {
        val player = player ?: return

        val restoredItems = GeneralStorage.restoreQueue()

        if (restoredItems.isNotEmpty()) {
            player.setMediaItems(restoredItems)

            val savedIndex = GeneralStorage.getSavedIndex()
            val savedPosition = GeneralStorage.getSavedPosition()
            val savedShuffleMode = GeneralStorage.getShuffleMode()
            val savedRepeatMode = GeneralStorage.getRepeatMode()

            if (savedIndex >= 0 && savedIndex < restoredItems.size) {
                player.seekTo(savedIndex, if (restorePosition) savedPosition else C.TIME_UNSET)
            } else {
                player.seekTo(0, 0L)
            }

            player.shuffleModeEnabled = savedShuffleMode
            player.repeatMode = savedRepeatMode

            player.playWhenReady = GeneralStorage.isAutoplayOnStartEnabled()
            player.prepare()

            // 软件冷启动时，恢复的歌曲并不会触发 onMediaTransition 事件，我们需要手动补发一个
            if (player.currentMediaItem != null) {
                sendTrackStartEvent(player.currentMediaItem, Player.MEDIA_ITEM_TRANSITION_REASON_PLAYLIST_CHANGED)
            }
        }
    }

    interface TrackEventListener {
        fun onTrackStarted(trackId: String, reason: Int)
        fun onTrackFinished(trackId: String, finalPosition: Double, duration: Double)
    }

    private val trackEventListeners = CopyOnWriteArrayList<TrackEventListener>()

    fun addTrackEventListener(listener: TrackEventListener) {
        trackEventListeners.add(listener)
    }

    fun removeTrackEventListener(listener: TrackEventListener) {
        trackEventListeners.remove(listener)
    }

    @OptIn(UnstableApi::class)
    private fun sendTrackStartEvent(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
        if (mediaItem == null) return
        
        // Notify local listeners
        trackEventListeners.forEach { it.onTrackStarted(mediaItem.mediaId, reason) }

        try {
            val intent = Intent(this, OrpheusHeadlessTaskService::class.java)
            intent.putExtra("eventName", "onTrackStarted")
            intent.putExtra("trackId", mediaItem.mediaId)
            intent.putExtra("reason", reason)
            startService(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun sendTrackFinishedEvent(trackId: String, finalPosition: Double, duration: Double) {
        // Notify local listeners
        trackEventListeners.forEach { it.onTrackFinished(trackId, finalPosition, duration) }

        try {
            val intent = Intent(this, OrpheusHeadlessTaskService::class.java)
            intent.putExtra("eventName", "onTrackFinished")
            intent.putExtra("trackId", trackId)
            intent.putExtra("finalPosition", finalPosition)
            intent.putExtra("duration", duration)
            startService(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupListeners() {
        player?.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
                    serviceHandler.removeCallbacks(lyricsUpdateRunnable)
                    serviceHandler.post(lyricsUpdateRunnable)
                } else {
                    serviceHandler.removeCallbacks(lyricsUpdateRunnable)
                }
            }

            @OptIn(UnstableApi::class)
            override fun onMediaItemTransition(
                mediaItem: androidx.media3.common.MediaItem?,
                reason: Int
            ) {
                sendTrackStartEvent(mediaItem, reason)

                floatingLyricsManager.setLyrics(emptyList())
                saveCurrentQueue()
                val uri = mediaItem?.localConfiguration?.uri?.toString() ?: return

                val volumeData = LoudnessStorage.getLoudnessData(uri)
                applyVolumeForCurrentItem(volumeData)
            }

            override fun onTimelineChanged(timeline: Timeline, reason: Int) {
                saveCurrentQueue()
                val player = player ?: return
                val currentItem = player.currentMediaItem ?: return
                val duration = player.duration
                if (duration != C.TIME_UNSET && duration > 0) {
                     durationCache[currentItem.mediaId] = duration
                }
            }

            override fun onPositionDiscontinuity(
                oldPosition: Player.PositionInfo,
                newPosition: Player.PositionInfo,
                reason: Int
            ) {
                val isAutoTransition = reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION
                val isIndexChanged = oldPosition.mediaItemIndex != newPosition.mediaItemIndex
                val lastMediaItem = oldPosition.mediaItem ?: return
                val currentTime = System.currentTimeMillis()
                
                // Debounce
                if ((currentTime - lastTrackFinishedAt) < 200) {
                    return
                }

                if (isAutoTransition || isIndexChanged) {
                    val duration = durationCache[lastMediaItem.mediaId] ?: return
                    lastTrackFinishedAt = currentTime
                    
                    sendTrackFinishedEvent(
                        lastMediaItem.mediaId,
                        oldPosition.positionMs / 1000.0,
                        duration / 1000.0
                    )
                }
            }
        })
    }

    private fun saveCurrentQueue() {
        val player = player ?: return
        val queue = List(player.mediaItemCount) { i -> player.getMediaItemAt(i) }
        if (queue.isNotEmpty()) {
            GeneralStorage.saveQueue(queue)
        }
    }

    @OptIn(UnstableApi::class)
    private fun applyVolumeForCurrentItem(measuredI: Double) {
        Log.d("LoudnessNormalization", "measuredI: $measuredI")
        val player = player ?: return
        volumeFadeJob?.cancel()
        val isLoudnessNormalizationEnabled = GeneralStorage.isLoudnessNormalizationEnabled()
        if (!isLoudnessNormalizationEnabled) return
        val gain = run {
            val target = -14.0 // bilibili 的这个值似乎是固定的
            if (measuredI == 0.0) 1.0f else calculateLoudnessGain(measuredI, target)
        }

        val targetVol = 1.0f * gain
        val currentVolume = player.volume

        if (abs(currentVolume - targetVol) < 0.001f) {
            return
        }

        volumeFadeJob = player.fadeInTo(targetVol, 600L, scope)
    }
}
