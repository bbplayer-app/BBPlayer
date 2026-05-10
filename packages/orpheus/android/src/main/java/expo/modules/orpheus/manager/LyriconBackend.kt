package expo.modules.orpheus.manager

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.media3.common.C
import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.model.LyricsLine
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
    @Volatile private var lastSong: Song? = null
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
        val song = lastSong
        val frame = synchronized(frameLock) { lastFrame }
        mainHandler.post {
            try {
                provider.player.setDisplayTranslation(true)
                song?.let { provider.player.setSong(it) }
                frame?.let { provider.player.setPosition(it.positionMs.coerceAtLeast(0L)) }
                provider.player.setPlaybackState(lastIsPlaying)
                Log.d(TAG, "[syncState] Restored song and state ($lastIsPlaying)")
            } catch (e: Exception) {
                Log.e(TAG, "[syncState] Failed: ${e.message}")
            }
        }
    }

    override fun setLyricsData(data: LyricsData) {
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
                provider.player.setSong(song)
                provider.player.setPlaybackState(lastIsPlaying)
                Log.d(TAG, "[setLyricsData] Sent song lines=${richLines.size} id=${song.id}")
            } catch (e: Exception) {
                Log.e(TAG, "[setLyricsData] Failed: ${e.message}")
            }
        }
    }

    override fun renderLyricFrame(frame: StatusBarLyricFrame?) {
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
                lastFrame = lastFrame?.copy(positionMs = clamped)
            }
            updatePositionInternal(clamped, logFailure = false)
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
        lastSong = null
        lastIsPlaying = false
        mainHandler.post {
            try {
                provider.player.setPlaybackState(false)
            } catch (e: Exception) {
                Log.e(TAG, "[destroy] Failed: ${e.message}")
            }
        }
    }

    private fun updatePositionInternal(positionMs: Long, logFailure: Boolean = true) {
        try {
            provider.player.setPosition(positionMs.coerceAtLeast(0L))
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
        const val DEFAULT_LINE_DURATION_MS = 5000L
    }
}
