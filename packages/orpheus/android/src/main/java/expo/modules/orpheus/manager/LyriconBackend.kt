package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import androidx.media3.common.C
import expo.modules.orpheus.model.LyricsLine
import expo.modules.orpheus.service.OrpheusMusicService
import io.github.proify.lyricon.provider.LyriconFactory
import io.github.proify.lyricon.provider.model.RichLyricLine
import io.github.proify.lyricon.provider.model.Song

private const val TAG = "LyriconBackend"

class LyriconBackend(context: Context) : StatusBarLyricsBackend(context) {

    private val provider = LyriconFactory.createProvider(context)
    @Volatile private var connected: Boolean = false
    private var offset: Double = 0.0

    override val isAvailable: Boolean
        get() = connected

    init {
        provider.service.addConnectionListener {
            onConnected {
                connected = true
                Log.d(TAG, "Lyricon service connected")
            }
            onReconnected {
                connected = true
                Log.d(TAG, "Lyricon service reconnected")
            }
            onDisconnected {
                connected = false
                Log.d(TAG, "Lyricon service disconnected")
            }
            onConnectTimeout {
                connected = false
                Log.w(TAG, "Lyricon service connection timed out")
            }
        }
        provider.register()
        Log.d(TAG, "LyriconBackend registered")
    }

    override fun setLyrics(lyrics: List<LyricsLine>, offset: Double) {
        this.offset = offset
        if (lyrics.isEmpty()) return

        val richLines = buildRichLines(lyrics, offset)

        // Read current track metadata from the player so Lyricon can use it for its own
        // lyrics cache/management UI. Cover art is NOT passed here — Lyricon auto-reads
        // that from the system MediaSession that BBPlayer already publishes via media3.
        val player = OrpheusMusicService.instance?.player
        val mediaItem = player?.currentMediaItem
        val title = mediaItem?.mediaMetadata?.title?.toString()
        val artist = mediaItem?.mediaMetadata?.artist?.toString()
        val trackId = mediaItem?.mediaId
        val durationMs = player?.duration?.takeIf { it != C.TIME_UNSET }

        val song = Song(
            id = trackId,
            name = title,
            artist = artist,
            duration = durationMs,
            lyrics = richLines,
        )

        try {
            provider.player.setSong(song)
            provider.player.setPlaybackState(true)
            Log.d(TAG, "[setLyrics] setSong lines=${richLines.size} id=$trackId name=$title artist=$artist")
        } catch (e: Exception) {
            Log.e(TAG, "[setLyrics] FAILED: ${e.message}", e)
        }
    }

    override fun updateTime(seconds: Double) {
        if (!connected) return
        val positionMs = ((seconds - offset) * 1000).toLong().coerceAtLeast(0L)
        try {
            provider.player.setPosition(positionMs)
        } catch (e: Exception) {
            Log.e(TAG, "[updateTime] FAILED: ${e.message}", e)
        }
    }

    override fun onStop() {
        offset = 0.0
        try {
            provider.player.setPlaybackState(false)
            Log.d(TAG, "[onStop] playback state set to false")
        } catch (e: Exception) {
            Log.e(TAG, "[onStop] FAILED: ${e.message}", e)
        }
    }

    /**
     * Stops playback and attempts to unregister the provider.
     * The Lyricon API does not expose an explicit unregister() method in current documentation,
     * so we send a stop signal to ensure the framework shows no stale lyrics.
     */
    override fun destroy() {
        try {
            provider.player.setPlaybackState(false)
            Log.d(TAG, "[destroy] provider stopped")
        } catch (e: Exception) {
            Log.e(TAG, "[destroy] FAILED: ${e.message}", e)
        }
    }

    private fun buildRichLines(lyrics: List<LyricsLine>, offset: Double): List<RichLyricLine> {
        // Lyrics are already sorted by the caller (StatusBarLyricsManager)
        return lyrics.mapIndexed { i, line ->
            val beginMs = ((line.timestamp - offset) * 1000).toLong().coerceAtLeast(0L)
            val endMs = if (i + 1 < lyrics.size) {
                ((lyrics[i + 1].timestamp - offset) * 1000).toLong().coerceAtLeast(beginMs)
            } else {
                beginMs + 5000L
            }
            RichLyricLine(
                begin = beginMs,
                end = endMs,
                text = line.text,
                translation = line.translation?.takeIf { it.isNotEmpty() }
            )
        }
    }
}
