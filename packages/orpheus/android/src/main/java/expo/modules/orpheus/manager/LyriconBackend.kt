package expo.modules.orpheus.manager

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import expo.modules.orpheus.service.OrpheusMusicService
import io.github.proify.lyricon.provider.LyriconFactory
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

    private val provider = LyriconFactory.createProvider(context)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val frameLock = Any()
    
    @Volatile private var connected: Boolean = false
    @Volatile private var lastFrame: StatusBarLyricFrame? = null
    @Volatile private var lastIsPlaying: Boolean = false

    override val isAvailable: Boolean
        get() = connected

    init {
        provider.service.addConnectionListener {
            onConnected {
                connected = true
                Log.d(TAG, "Lyricon connected - syncing state")
                syncState()
                notifyStatusChanged()
            }
            onReconnected {
                connected = true
                Log.d(TAG, "Lyricon reconnected - syncing state")
                syncState()
                notifyStatusChanged()
            }
            onDisconnected {
                connected = false
                Log.d(TAG, "Lyricon disconnected")
                notifyStatusChanged()
            }
            onConnectTimeout {
                connected = false
                Log.w(TAG, "Lyricon connection timeout")
                notifyStatusChanged()
            }
        }
        provider.register()
    }

    private fun notifyStatusChanged() {
        OrpheusMusicService.instance?.statusBarLyricsManager?.notifyStatusChanged()
    }

    private fun syncState() {
        val frame = synchronized(frameLock) { lastFrame }
        mainHandler.post {
            try {
                provider.player.setDisplayTranslation(true)
                frame?.let(::renderFrameInternal)
                provider.player.setPlaybackState(lastIsPlaying)
                Log.d(TAG, "[syncState] Restored current lyric frame and state ($lastIsPlaying)")
            } catch (e: Exception) {
                Log.e(TAG, "[syncState] Failed: ${e.message}")
            }
        }
    }

    override fun renderLyricFrame(frame: StatusBarLyricFrame?) {
        synchronized(frameLock) {
            lastFrame = frame
        }

        if (frame == null) {
            clearLyrics()
            return
        }

        mainHandler.post {
            renderFrameInternal(frame)
        }
    }

    private fun clearLyrics() {
        synchronized(frameLock) {
            lastFrame = null
        }
        mainHandler.post {
            try {
                provider.player.setSong(Song(lyrics = emptyList()))
                provider.player.setPlaybackState(false)
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
                lastFrame = lastFrame?.copy(lineProgressMs = clamped)
            }
            try {
                provider.player.setPosition(clamped)
            } catch (_: Exception) {
                // Suppress frequent logging in updateProgress
            }
        }
    }

    override fun setPlaybackState(isPlaying: Boolean) {
        lastIsPlaying = isPlaying
        mainHandler.post {
            try {
                provider.player.setPlaybackState(isPlaying)
                Log.d(TAG, "[setPlaybackState] $isPlaying")
            } catch (e: Exception) {
                Log.e(TAG, "[setPlaybackState] Failed: ${e.message}")
            }
        }
    }

    override fun onStop() {
        synchronized(frameLock) {
            lastFrame = null
        }
        lastIsPlaying = false
        mainHandler.post {
            try {
                provider.player.setPlaybackState(false)
            } catch (e: Exception) {
                Log.e(TAG, "[onStop] Failed: ${e.message}")
            }
        }
    }

    override fun destroy() {
        synchronized(frameLock) {
            lastFrame = null
        }
        lastIsPlaying = false
        mainHandler.post {
            try {
                provider.player.setPlaybackState(false)
            } catch (e: Exception) {
                Log.e(TAG, "[destroy] Failed: ${e.message}")
            }
        }
    }

    private fun renderFrameInternal(frame: StatusBarLyricFrame) {
        val player = OrpheusMusicService.instance?.player
        val mediaItem = player?.currentMediaItem
        val line = frame.line
        val lineStartMs = (line.timestamp * 1000).toLong().coerceAtLeast(0L)
        val words = line.spans?.map { span ->
            val begin = (span.startTime - lineStartMs).coerceAtLeast(0L)
            val end = (span.endTime - lineStartMs).coerceAtLeast(begin)

            LyricWord(
                begin = begin,
                end = end,
                duration = (end - begin).coerceAtLeast(0L),
                text = span.text,
            )
        }

        val richLine = RichLyricLine(
            begin = 0L,
            end = frame.lineDurationMs.coerceAtLeast(1L),
            text = line.text,
            words = words,
            translation = line.translation?.ifEmpty { null } ?: line.romaji?.ifEmpty { null },
        )
        val song = Song(
            id = mediaItem?.mediaId ?: "",
            name = mediaItem?.mediaMetadata?.title?.toString() ?: "",
            artist = mediaItem?.mediaMetadata?.artist?.toString() ?: "",
            duration = frame.lineDurationMs.coerceAtLeast(1L),
            lyrics = listOf(richLine),
        )

        try {
            provider.player.setSong(song)
            provider.player.setPosition(frame.lineProgressMs.coerceAtLeast(0L))
            provider.player.setPlaybackState(lastIsPlaying)
            Log.d(TAG, "[render] Sent current line song id=${song.id} text=\"${line.text}\"")
        } catch (e: Exception) {
            Log.e(TAG, "[render] Failed: ${e.message}")
        }
    }
}
