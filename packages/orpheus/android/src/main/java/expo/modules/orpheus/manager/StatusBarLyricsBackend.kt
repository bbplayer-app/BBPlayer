package expo.modules.orpheus.manager

import android.content.Context
import expo.modules.orpheus.model.LyricsLine

/**
 * Abstract backend for status bar lyrics frameworks.
 * Concrete implementations wrap SuperLyric and Lyricon respectively.
 */
abstract class StatusBarLyricsBackend(protected val context: Context) {
    /** Whether the underlying framework service is active/connected. */
    abstract val isAvailable: Boolean

    /**
     * Called when a new lyrics list is ready (e.g. on track change).
     * @param lyrics sorted by timestamp (seconds)
     * @param offset playback offset in seconds subtracted from playback time / line timestamps
     */
    abstract fun setLyrics(lyrics: List<LyricsLine>, offset: Double)

    /**
     * Called continuously with the current playback position.
     * @param seconds current position in seconds
     */
    abstract fun updateTime(seconds: Double)

    /** Called when playback stops or the track changes. */
    abstract fun onStop()

    /** Optional cleanup hook called when this backend is no longer needed. */
    open fun destroy() {}
}
