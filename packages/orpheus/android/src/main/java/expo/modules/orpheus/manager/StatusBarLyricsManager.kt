package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import android.widget.Toast
import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.util.GeneralStorage

private const val TAG = "StatusBarLyrics"

/**
 * Orchestrates status bar lyrics by switching between providers
 * and maintaining the currently rendered line state.
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
            if (prev != value) backend?.setEnabled(value)
            if (!prev && field) {
                reapplyCurrentState()
            }
        }

    /** Active backend; swap to switch between SuperLyric and Lyricon. */
    var backend: StatusBarLyricsBackend? = null
        set(value) {
            val previous = field
            if (previous != null) {
                previous.onConnectionFailed = null
                if (enabled) previous.onStop()
                previous.destroy()
            }
            field = value
            value?.onConnectionFailed = { onConnectionFailed(value) }
            Log.d(TAG, "[backend] switched to ${value?.javaClass?.simpleName}")

            if (enabled) {
                value?.setEnabled(true)
                if (enabled) reapplyCurrentState()
            }
        }

    private var lastFrame: StatusBarLyricFrame? = null
    private var lastLyricsData: LyricsData? = null
    private var lastIsPlaying: Boolean = false

    private fun onConnectionFailed(failedBackend: StatusBarLyricsBackend) {
        if (backend !== failedBackend || !enabled) return
        GeneralStorage.setStatusBarLyricsEnabled(false)
        enabled = false
        Toast.makeText(
            context,
            "未能连接词幕，已关闭状态栏歌词。请确认词幕模块可用后重试",
            Toast.LENGTH_LONG,
        ).show()
        notifyStatusChanged()
    }

    fun setLyricsData(data: LyricsData) {
        lastLyricsData = data

        if (!enabled) return

        backend?.setLyricsData(data)
    }

    fun renderLyricFrame(frame: StatusBarLyricFrame?) {
        lastFrame = frame

        if (!enabled) return

        backend?.renderLyricFrame(frame)
    }

    fun updateProgress(positionMs: Long, lineProgressMs: Long) {
        lastFrame = lastFrame?.copy(
            positionMs = positionMs,
            lineProgressMs = lineProgressMs,
        )

        if (!enabled) return

        backend?.updateProgress(positionMs)
    }

    fun setPlaybackState(isPlaying: Boolean) {
        lastIsPlaying = isPlaying

        if (!enabled) return

        backend?.setPlaybackState(isPlaying)
    }

    fun onStop() {
        lastFrame = null
        lastLyricsData = null
        lastIsPlaying = false
        backend?.onStop()
    }

    fun destroy() {
        onStop()
        backend = null
        statusChangeListener = null
    }

    private fun reapplyCurrentState() {
        lastLyricsData?.let { backend?.setLyricsData(it) }
        backend?.renderLyricFrame(lastFrame)
        backend?.setPlaybackState(lastIsPlaying)
        lastFrame?.let { backend?.updateProgress(it.positionMs) }
    }
}
