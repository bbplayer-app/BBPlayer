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

@RequiresApi(Build.VERSION_CODES.O_MR1)
class LyriconBackend(context: Context) : StatusBarLyricsBackend(context) {

    private val provider = LyriconFactory.createProvider(context)
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile private var connected: Boolean = false
    private var offset: Double = 0.0

    override val isAvailable: Boolean
        get() = connected

    init {
        provider.service.addConnectionListener {
            onConnected {
                connected = true
                provider.player.setDisplayTranslation(true)
                Log.d(TAG, "Lyricon service connected (translation enabled)")
                OrpheusMusicService.instance?.statusBarLyricsManager?.notifyStatusChanged()
            }
            onReconnected {
                connected = true
                provider.player.setDisplayTranslation(true)
                Log.d(TAG, "Lyricon service reconnected")
                OrpheusMusicService.instance?.statusBarLyricsManager?.notifyStatusChanged()
            }
            onDisconnected {
                connected = false
                Log.d(TAG, "Lyricon service disconnected")
                OrpheusMusicService.instance?.statusBarLyricsManager?.notifyStatusChanged()
            }
            onConnectTimeout {
                connected = false
                Log.w(TAG, "Lyricon service connection timed out")
                OrpheusMusicService.instance?.statusBarLyricsManager?.notifyStatusChanged()
            }
        }
        provider.register()
        Log.d(TAG, "LyriconBackend registered")
    }

    override fun setLyrics(lyrics: List<LyricsLine>, offset: Double) {
        this.offset = offset
        Log.d(TAG, "[setLyrics] Called with ${lyrics.size} lines, offset: $offset")

        if (lyrics.isEmpty()) {
            // Explicitly clear Lyricon state so stale lyrics from the previous track
            // are not left visible when the current track has no lyrics.
            try {
                provider.player.setSong(Song(lyrics = emptyList<RichLyricLine>()))
                provider.player.setPlaybackState(false)
                Log.d(TAG, "[setLyrics] cleared: empty song sent")
            } catch (e: Exception) {
                Log.e(TAG, "[setLyrics] FAILED to clear: ${e.message}", e)
            }
            return
        }

        val richLines = buildRichLines(lyrics, offset)

        // Read current track metadata from the player so Lyricon can use it for its own
        // lyrics cache/management UI. Cover art is NOT passed here — Lyricon auto-reads
        // that from the system MediaSession that BBPlayer already publishes via media3.
        // ExoPlayer must be accessed on the main thread.
        mainHandler.post {
            val player = OrpheusMusicService.instance?.player
            val mediaItem = player?.currentMediaItem
            val title = mediaItem?.mediaMetadata?.title?.toString()
            val artist = mediaItem?.mediaMetadata?.artist?.toString()
            val trackId = mediaItem?.mediaId
            val durationMs = player?.duration?.takeIf { it != C.TIME_UNSET }
            // Reflect actual player state instead of unconditionally assuming playback is active.
            val isPlaying = player?.isPlaying ?: false
            Log.d(TAG, "[setLyrics] Resolved Metadata (MainThread) - trackId: $trackId, title: $title, artist: $artist, duration: $durationMs, isPlaying: $isPlaying")

            val song = Song(
                id = trackId ?: "",
                name = title ?: "",
                artist = artist ?: "",
                duration = durationMs ?: 0L,
                lyrics = richLines,
            )

            try {
                provider.player.setSong(song)
                provider.player.setPlaybackState(isPlaying)
                Log.d(TAG, "[setLyrics] setSong lines=${richLines.size} id=$trackId name=$title artist=$artist playing=$isPlaying")
            } catch (e: Exception) {
                Log.e(TAG, "[setLyrics] FAILED: ${e.message}", e)
            }
        }
    }

    override fun updateTime(seconds: Double) {
        if (!connected) {
            Log.v(TAG, "[updateTime] Ignored: not connected. (seconds: $seconds)")
            return
        }
        val positionMs = ((seconds - offset) * 1000).toLong().coerceAtLeast(0L)
        Log.v(TAG, "[updateTime] positionMs: $positionMs (seconds: $seconds, offset: $offset)")
        try {
            provider.player.setPosition(positionMs)
        } catch (e: Exception) {
            Log.e(TAG, "[updateTime] FAILED: ${e.message}", e)
        }
    }

    override fun onStop() {
        offset = 0.0
        mainHandler.post {
            try {
                provider.player.setPlaybackState(false)
                Log.d(TAG, "[onStop] playback state set to false")
            } catch (e: Exception) {
                Log.e(TAG, "[onStop] FAILED: ${e.message}", e)
            }
        }
    }

    /**
     * Stops playback and attempts to unregister the provider.
     * The Lyricon API does not expose an explicit unregister() method in current documentation,
     * so we send a stop signal to ensure the framework shows no stale lyrics.
     */
    override fun destroy() {
        mainHandler.post {
            try {
                provider.player.setPlaybackState(false)
                Log.d(TAG, "[destroy] provider stopped")
            } catch (e: Exception) {
                Log.e(TAG, "[destroy] FAILED: ${e.message}", e)
            }
        }
    }

    private fun buildRichLines(lyrics: List<LyricsLine>, offset: Double): List<RichLyricLine> {
        Log.d(TAG, "[buildRichLines] Processing ${lyrics.size} lines, applying offset: $offset")
        // Lyrics are already sorted by the caller (StatusBarLyricsManager)
        return lyrics.map { line ->
            val beginMs = ((line.timestamp - offset) * 1000).toLong().coerceAtLeast(0L)
            val endMs = if (line.endTime != null) {
                ((line.endTime - offset) * 1000).toLong().coerceAtLeast(beginMs)
            } else {
                beginMs + 5000L
            }

            val words = line.spans?.map { span ->
                LyricWord(
                    begin = (span.startTime - offset * 1000).toLong().coerceAtLeast(0L),
                    end = (span.endTime - offset * 1000).toLong().coerceAtLeast(0L),
                    duration = span.duration,
                    text = span.text
                )
            }

            RichLyricLine(
                begin = beginMs,
                end = endMs,
                text = line.text,
                words = words,
                translation = line.translations?.getOrNull(0)?.takeIf { it.isNotEmpty() }
            )
        }
    }
}
