package expo.modules.orpheus.manager

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.media3.common.C
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
    
    @Volatile private var connected: Boolean = false
    @Volatile private var offset: Double = 0.0
    @Volatile private var lastSong: Song? = null
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
        mainHandler.post {
            try {
                provider.player.setDisplayTranslation(true)
                lastSong?.let { song ->
                    provider.player.setSong(song)
                    provider.player.setPlaybackState(lastIsPlaying)
                    Log.d(TAG, "[syncState] Restored song and state ($lastIsPlaying)")
                }
            } catch (e: Exception) {
                Log.e(TAG, "[syncState] Failed: ${e.message}")
            }
        }
    }

    override fun setLyrics(lyrics: List<LyricsLine>, offset: Double) {
        this.offset = offset

        if (lyrics.isEmpty()) {
            clearLyrics()
            return
        }

        val richLines = buildRichLines(lyrics, offset)

        mainHandler.post {
            val player = OrpheusMusicService.instance?.player
            val mediaItem = player?.currentMediaItem
            val isPlaying = player?.isPlaying ?: false

            val song = Song(
                id = mediaItem?.mediaId ?: "",
                name = mediaItem?.mediaMetadata?.title?.toString() ?: "",
                artist = mediaItem?.mediaMetadata?.artist?.toString() ?: "",
                duration = player?.duration?.takeIf { it != C.TIME_UNSET } ?: 0L,
                lyrics = richLines,
            )
            
            lastSong = song
            lastIsPlaying = isPlaying

            try {
                provider.player.setSong(song)
                provider.player.setPlaybackState(isPlaying)
                Log.d(TAG, "[setLyrics] Sent song lines=${richLines.size} id=${song.id} playing=$isPlaying")
            } catch (e: Exception) {
                Log.e(TAG, "[setLyrics] Failed: ${e.message}")
            }
        }
    }

    private fun clearLyrics() {
        lastSong = null
        lastIsPlaying = false
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

    override fun updateTime(seconds: Double) {
        if (!connected) return
        
        val positionMs = ((seconds - offset) * 1000).toLong().coerceAtLeast(0L)
        try {
            provider.player.setPosition(positionMs)
        } catch (e: Exception) {
            // Suppress frequent logging in updateTime
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
        offset = 0.0
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

    private fun buildRichLines(lyrics: List<LyricsLine>, offset: Double): List<RichLyricLine> {
        return lyrics.map { line ->
            val beginMs = (line.timestamp * 1000).toLong().coerceAtLeast(0L)
            val endMs = if (line.endTime != null) {
                (line.endTime * 1000).toLong().coerceAtLeast(beginMs)
            } else {
                beginMs + 5000L
            }

            val words = line.spans?.map { span ->
                LyricWord(
                    begin = span.startTime,
                    end = span.endTime,
                    duration = span.duration,
                    text = span.text
                )
            }

            RichLyricLine(
                begin = beginMs,
                end = endMs,
                text = line.text,
                words = words,
                translation = line.translation ?: line.romaji
            )
        }
    }
}
