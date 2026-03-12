package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import expo.modules.orpheus.model.LyricsLine

private const val TAG = "StatusBarLyrics"

/**
 * Orchestrates status bar lyrics by switching between providers
 * and maintaining playback state / lyric cache.
 */
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
            if (prev && !value) {
                backend?.onStop()
            }
        }

    /** Active backend; swap to switch between SuperLyric and Lyricon. */
    var backend: StatusBarLyricsBackend? = null
        set(value) {
            val previous = field
            if (previous != null) {
                if (enabled) previous.onStop()
                previous.destroy()
            }
            field = value
            Log.d(TAG, "[backend] switched to ${value?.javaClass?.simpleName}")
            
            // Re-apply cached lyrics to the new backend immediately
            val cachedLyrics = lastLyrics
            if (enabled && cachedLyrics != null) {
                value?.setLyrics(cachedLyrics, lastOffset)
            }
        }

    private var lastLyrics: List<LyricsLine>? = null
    private var lastOffset: Double = 0.0

    fun setLyrics(newLyrics: List<LyricsLine>, newOffset: Double = 0.0) {
        val sorted = newLyrics.sortedBy { it.timestamp }
        lastLyrics = sorted
        lastOffset = newOffset
        
        if (enabled) {
            backend?.setLyrics(sorted, newOffset)
        }
    }

    fun updateTime(seconds: Double) {
        if (enabled) {
            backend?.updateTime(seconds)
        }
    }

    fun setPlaybackState(isPlaying: Boolean) {
        if (enabled) {
            backend?.setPlaybackState(isPlaying)
        }
    }

    fun onStop() {
        lastLyrics = null
        lastOffset = 0.0
        backend?.onStop()
    }
}
