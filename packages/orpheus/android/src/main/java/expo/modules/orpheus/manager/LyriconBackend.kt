package expo.modules.orpheus.manager

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.media3.common.C
import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.model.LyricsLine
import expo.modules.orpheus.service.OrpheusMusicService
import io.github.proify.lyricon.provider.LyriconFactory
import io.github.proify.lyricon.provider.LyriconProvider
import io.github.proify.lyricon.provider.ConnectionStatus
import io.github.proify.lyricon.provider.isDisconnected
import io.github.proify.lyricon.lyric.model.RichLyricLine
import io.github.proify.lyricon.lyric.model.LyricWord
import io.github.proify.lyricon.lyric.model.Song
import io.github.proify.lyricon.provider.service.addConnectionListener

private const val TAG = "LyriconBackend"

/**
 * Lyricon implementation for status bar lyrics.
 * Supports per-word (dynamic) lyrics and translations via AIDL IPC.
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
class LyriconBackend(context: Context) : StatusBarLyricsBackend(context) {

    private var provider: LyriconProvider? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val frameLock = Any()

    @Volatile private var connected: Boolean = false
    @Volatile private var lastSong: Song? = null
    @Volatile private var lastFrame: StatusBarLyricFrame? = null
    @Volatile private var lastIsPlaying: Boolean = false
    @Volatile private var destroyed: Boolean = false
    private var connectionRequested = false
    private var connectionCheck: Runnable? = null

    override val isAvailable: Boolean
        get() = connected && !destroyed

    private fun connect() {
        val current = LyriconFactory.createProvider(context)
        provider = current
        current.service.addConnectionListener {
            onConnected {
                if (destroyed || provider !== current) return@onConnected
                cancelConnectionCheck()
                connected = true
                Log.d(TAG, "Lyricon connected - syncing state")
                syncState()
                notifyStatusChanged()
            }
            onReconnected {
                if (destroyed || provider !== current) return@onReconnected
                cancelConnectionCheck()
                connected = true
                Log.d(TAG, "Lyricon reconnected - syncing state")
                syncState()
                notifyStatusChanged()
            }
            onDisconnected {
                if (provider !== current) return@onDisconnected
                connected = false
                Log.d(TAG, "Lyricon disconnected")
                failConnection()
            }
            onConnectTimeout {
                if (provider !== current) return@onConnectTimeout
                connected = false
                Log.w(TAG, "Lyricon connection timeout")
                failConnection()
            }
        }
        val deadline = SystemClock.uptimeMillis() + CONNECTION_TIMEOUT_MS
        val check = object : Runnable {
            override fun run() {
                if (provider !== current || destroyed || connected) return
                if (current.service.connectionStatus.isDisconnected() || SystemClock.uptimeMillis() >= deadline) {
                    failConnection()
                } else {
                    mainHandler.postDelayed(this, CONNECTION_CHECK_INTERVAL_MS)
                }
            }
        }
        connectionCheck = check
        try {
            if (!current.register() && current.service.connectionStatus != ConnectionStatus.CONNECTED) {
                failConnection()
                return
            }
            if (provider === current && !connected) mainHandler.postDelayed(check, CONNECTION_CHECK_INTERVAL_MS)
        } catch (e: Exception) {
            Log.e(TAG, "[connect] Failed: ${e.message}")
            failConnection()
        }
    }

    override fun setEnabled(enabled: Boolean) {
        if (destroyed || connectionRequested == enabled) return
        connectionRequested = enabled
        if (enabled) {
            connect()
        } else {
            disconnect()
            notifyStatusChanged()
        }
    }

    private fun cancelConnectionCheck() {
        connectionCheck?.let { mainHandler.removeCallbacks(it) }
        connectionCheck = null
    }

    private fun disconnect() {
        cancelConnectionCheck()
        connected = false
        val current = provider
        provider = null
        try {
            current?.player?.setPlaybackState(false)
        } catch (e: Exception) {
            Log.e(TAG, "[disconnect] Failed to send pause: ${e.message}")
        } finally {
            // Destroy also cancels the provider's retry scope and unregisters its connection.
            current?.destroy()
        }
    }

    private fun failConnection() {
        if (destroyed || !connectionRequested) return
        connectionRequested = false
        disconnect()
        onConnectionFailed?.invoke()
        notifyStatusChanged()
    }

    private fun notifyStatusChanged() {
        OrpheusMusicService.instance?.statusBarLyricsManager?.notifyStatusChanged()
    }

    private fun syncState() {
        val song = lastSong
        val frame = synchronized(frameLock) { lastFrame }
        mainHandler.post {
            if (destroyed) return@post
            try {
                provider?.player?.setDisplayTranslation(true)
                song?.let { provider?.player?.setSong(it) }
                frame?.let { provider?.player?.setPosition(it.positionMs.coerceAtLeast(0L)) }
                provider?.player?.setPlaybackState(lastIsPlaying)
                Log.d(TAG, "[syncState] Restored song and state ($lastIsPlaying)")
            } catch (e: Exception) {
                Log.e(TAG, "[syncState] Failed: ${e.message}")
            }
        }
    }

    override fun setLyricsData(data: LyricsData) {
        if (destroyed) return
        if (data.lyrics.isEmpty()) {
            clearLyrics()
            return
        }

        val richLines = buildRichLines(data.lyrics)

        mainHandler.post {
            val player = OrpheusMusicService.instance?.player
            val mediaItem = player?.currentMediaItem
            val fallbackDuration = richLines.maxOfOrNull { it.end } ?: 0L
            val song = Song(
                id = mediaItem?.mediaId ?: "",
                name = mediaItem?.mediaMetadata?.title?.toString() ?: "",
                artist = mediaItem?.mediaMetadata?.artist?.toString() ?: "",
                duration = player?.duration?.takeIf { it != C.TIME_UNSET } ?: fallbackDuration,
                lyrics = richLines,
            )

            lastSong = song

            try {
                provider?.player?.setSong(song)
                provider?.player?.setPlaybackState(lastIsPlaying)
                Log.d(TAG, "[setLyricsData] Sent song lines=${richLines.size} id=${song.id}")
            } catch (e: Exception) {
                Log.e(TAG, "[setLyricsData] Failed: ${e.message}")
            }
        }
    }

    override fun renderLyricFrame(frame: StatusBarLyricFrame?) {
        if (destroyed) return
        synchronized(frameLock) {
            lastFrame = frame
        }

        if (frame == null) {
            return
        }

        mainHandler.post {
            updatePositionInternal(frame.positionMs)
        }
    }

    private fun clearLyrics() {
        synchronized(frameLock) {
            lastFrame = null
        }
        lastSong = null
        mainHandler.post {
            try {
                provider?.player?.setSong(Song(lyrics = emptyList()))
                provider?.player?.setPlaybackState(false)
                Log.d(TAG, "[clearLyrics] Lyrics cleared")
            } catch (e: Exception) {
                Log.e(TAG, "[clearLyrics] Failed: ${e.message}")
            }
        }
    }

    override fun updateProgress(positionMs: Long) {
        if (!connected) return

        val clamped = positionMs.coerceAtLeast(0L)
        mainHandler.post {
            if (!connected) return@post

            synchronized(frameLock) {
                lastFrame = lastFrame?.copy(positionMs = clamped)
            }
            updatePositionInternal(clamped, logFailure = false)
        }
    }

    override fun setPlaybackState(isPlaying: Boolean) {
        if (destroyed) return
        lastIsPlaying = isPlaying
        mainHandler.post {
            if (destroyed) return@post
            try {
                provider?.player?.setPlaybackState(lastIsPlaying)
                Log.d(TAG, "[setPlaybackState] $lastIsPlaying")
            } catch (e: Exception) {
                Log.e(TAG, "[setPlaybackState] Failed: ${e.message}")
            }
        }
    }

    override fun onStop() {
        synchronized(frameLock) {
            lastFrame = null
        }
        setPlaybackState(false)
    }

    override fun destroy() {
        if (destroyed) return
        destroyed = true
        connectionRequested = false
        connected = false
        mainHandler.removeCallbacksAndMessages(null)
        synchronized(frameLock) {
            lastFrame = null
        }
        lastSong = null
        lastIsPlaying = false
        disconnect()
    }

    private fun updatePositionInternal(positionMs: Long, logFailure: Boolean = true) {
        try {
            provider?.player?.setPosition(positionMs.coerceAtLeast(0L))
        } catch (e: Exception) {
            if (logFailure) {
                Log.e(TAG, "[position] Failed: ${e.message}")
            }
        }
    }

    private fun buildRichLines(lyrics: List<LyricsLine>): List<RichLyricLine> {
        return lyrics.mapIndexed { index, line ->
            val lineStartMs = (line.timestamp * 1000).toLong().coerceAtLeast(0L)
            val lineEndMs = line.endTime
                ?.times(1000)
                ?.toLong()
                ?.coerceAtLeast(lineStartMs)
                ?: lyrics.getOrNull(index + 1)
                    ?.timestamp
                    ?.times(1000)
                    ?.toLong()
                    ?.coerceAtLeast(lineStartMs)
                ?: line.spans?.lastOrNull()?.endTime?.coerceAtLeast(lineStartMs)
                ?: (lineStartMs + DEFAULT_LINE_DURATION_MS)
            val words = line.spans?.map { span ->
                LyricWord(
                    begin = span.startTime,
                    end = span.endTime,
                    duration = span.duration,
                    text = span.text,
                )
            }

            RichLyricLine(
                begin = lineStartMs,
                end = lineEndMs,
                text = line.text,
                words = words,
                translation = line.translation?.ifEmpty { null } ?: line.romaji?.ifEmpty { null },
            )
        }
    }

    private companion object {
        const val CONNECTION_TIMEOUT_MS = 4_000L
        const val CONNECTION_CHECK_INTERVAL_MS = 100L
        const val DEFAULT_LINE_DURATION_MS = 5000L
    }
}
