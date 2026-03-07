package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import expo.modules.orpheus.model.LyricsLine

private const val TAG = "StatusBarLyrics"

class StatusBarLyricsManager(private val context: Context) {

    var enabled: Boolean = false
        set(value) {
            val prev = field
            field = value
            Log.d(TAG, "[enabled] $prev -> $value")
            if (prev && !value) {
                backend?.onStop()
            }
        }

    /** Active backend; swap to switch between SuperLyric and Lyricon. */
    var backend: StatusBarLyricsBackend? = null
        set(value) {
            field?.destroy()
            field = value
            Log.d(TAG, "[backend] switched to ${value?.javaClass?.simpleName}")
            // Re-apply cached lyrics to the new backend regardless of enabled state,
            // so it is ready when the feature is toggled on.
            val cachedLyrics = lastLyrics
            if (cachedLyrics != null) {
                value?.setLyrics(cachedLyrics, lastOffset)
            }
        }

    private var lastLyrics: List<LyricsLine>? = null
    private var lastOffset: Double = 0.0

    fun setLyrics(newLyrics: List<LyricsLine>, newOffset: Double = 0.0) {
        val firstLine = newLyrics.firstOrNull()?.text ?: "(none)"
        Log.d(TAG, "[setLyrics] count=${newLyrics.size} offset=$newOffset | enabled=$enabled | first=\"$firstLine\"")
        val sorted = newLyrics.sortedBy { it.timestamp }
        // Always cache so the backend can be re-initialized (e.g., provider switch) with fresh data.
        lastLyrics = sorted
        lastOffset = newOffset
        if (!enabled) return
        backend?.setLyrics(sorted, newOffset)
    }

    fun updateTime(seconds: Double) {
        if (!enabled) return
        backend?.updateTime(seconds)
    }

    fun onStop() {
        Log.d(TAG, "[onStop] enabled=$enabled")
        lastLyrics = null
        lastOffset = 0.0
        backend?.onStop()
    }
}

