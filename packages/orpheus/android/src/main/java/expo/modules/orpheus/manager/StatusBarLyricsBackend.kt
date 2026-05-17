package expo.modules.orpheus.manager

import android.content.Context
import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.model.LyricsLine

data class StatusBarLyricFrame(
    val line: LyricsLine,
    val positionMs: Long,
    val lineDurationMs: Long,
    val lineProgressMs: Long,
    val delayMs: Int,
)

/**
 * Abstract backend for status bar lyrics frameworks.
 * Concrete implementations wrap SuperLyric and Lyricon respectively.
 */
abstract class StatusBarLyricsBackend(protected val context: Context) {
    /** Whether the underlying framework service is active/connected. */
    abstract val isAvailable: Boolean

    /** Called when the full status bar lyric set changes. */
    open fun setLyricsData(data: LyricsData) {}

    /** Called when the status bar lyrics consumer selects a new current line. */
    abstract fun renderLyricFrame(frame: StatusBarLyricFrame?)

    /** Called continuously with the current projected song position. */
    abstract fun updateProgress(positionMs: Long)

    /** Called when the player starts or pauses. */
    abstract fun setPlaybackState(isPlaying: Boolean)

    /** Called when playback stops or the track changes. */
    abstract fun onStop()

    /** Optional cleanup hook called when this backend is no longer needed. */
    open fun destroy() {}
}
