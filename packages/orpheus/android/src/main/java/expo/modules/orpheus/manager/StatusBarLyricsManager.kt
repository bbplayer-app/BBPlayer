package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import expo.modules.orpheus.model.LyricsLine

private const val TAG = "StatusBarLyrics"

class StatusBarLyricsManager(private val context: Context) {

    interface StatusChangeListener {
        fun onStatusChanged()
    }

    private var statusChangeListener: StatusChangeListener? = null

    fun setStatusChangeListener(listener: StatusChangeListener?) {
        statusChangeListener = listener
    }

    fun notifyStatusChanged() {
        statusChangeListener?.onStatusChanged()
    }

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
            val previous = field
            if (previous != null) {
                if (enabled) {
                    previous.onStop()
                }
                previous.destroy()
            }
            field = value
            Log.d(TAG, "[backend] switched to ${value?.javaClass?.simpleName}")
            // Re-apply cached lyrics to the new backend only when enabled,
            // to avoid activating lyrics while the feature is turned off.
            val cachedLyrics = lastLyrics
            if (enabled && cachedLyrics != null) {
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

