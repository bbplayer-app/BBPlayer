package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import com.hchen.superlyricapi.SuperLyricData
import com.hchen.superlyricapi.SuperLyricPush
import com.hchen.superlyricapi.SuperLyricTool
import expo.modules.orpheus.model.LyricsLine

private const val TAG = "SuperLyricBackend"

/**
 * SuperLyric implementation for status bar lyrics.
 * Simple line-by-line display protocol.
 */
class SuperLyricBackend(context: Context) : StatusBarLyricsBackend(context) {

    override val isAvailable: Boolean
        get() = SuperLyricTool.isEnabled

    private var lastLyrics: List<LyricsLine> = emptyList()
    private var lastOffset: Double = 0.0
    private var lastLineIndex: Int = -1
    private var lastSkipLogTime: Long = 0L

    override fun setLyrics(lyrics: List<LyricsLine>, offset: Double) {
        this.lastLyrics = lyrics
        this.lastOffset = offset
        this.lastLineIndex = -1
    }

    override fun updateTime(seconds: Double) {
        if (!SuperLyricTool.isEnabled) {
            logThrottle("SuperLyric not active")
            return
        }

        if (lastLyrics.isEmpty()) {
            logThrottle("Lyrics empty")
            return
        }

        lastSkipLogTime = 0L

        val adjustedTime = seconds - lastOffset
        val index = lastLyrics.indexOfLast { it.timestamp <= adjustedTime }

        if (index < 0 || index == lastLineIndex) return

        sendLineToSuperLyric(index, seconds, adjustedTime)
    }

    private fun sendLineToSuperLyric(index: Int, seconds: Double, adjustedTime: Double) {
        if (index < 0 || index >= lastLyrics.size) return
        val line = lastLyrics[index]
        val nextTimestamp = lastLyrics.getOrNull(index + 1)?.timestamp
        val delayMs = if (nextTimestamp != null) {
            ((nextTimestamp - line.timestamp) * 1000).toInt()
        } else {
            0
        }

        val translation = line.translations?.firstOrNull()
        lastLineIndex = index

        val data = SuperLyricData()
            .setLyric(line.text)
            .setPackageName(context.packageName)
            .setDelay(delayMs)

        if (!translation.isNullOrEmpty()) {
            data.setTranslation(translation)
        }

        try {
            SuperLyricPush.onSuperLyric(data)
            Log.d(TAG, "[sendLine] index=$index text=\"${line.text}\"")
        } catch (e: Exception) {
            Log.e(TAG, "[sendLine] Failed: ${e.message}")
        }
    }

    override fun setPlaybackState(isPlaying: Boolean) {
        if (isPlaying && lastLineIndex >= 0) {
            // Re-send current line on resume to ensure it remains visible
            sendLineToSuperLyric(lastLineIndex, 0.0, 0.0)
        }
    }

    override fun onStop() {
        lastLyrics = emptyList()
        lastLineIndex = -1
        lastSkipLogTime = 0L

        if (!SuperLyricTool.isEnabled) return

        try {
            SuperLyricPush.onStop(SuperLyricData().setPackageName(context.packageName))
        } catch (e: Exception) {
            Log.e(TAG, "[onStop] Failed: ${e.message}")
        }
    }

    private fun logThrottle(message: String) {
        val now = System.currentTimeMillis()
        if (now - lastSkipLogTime > 5000) {
            Log.w(TAG, message)
            lastSkipLogTime = now
        }
    }
}
