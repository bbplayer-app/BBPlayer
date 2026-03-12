package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import com.hchen.superlyricapi.SuperLyricData
import com.hchen.superlyricapi.SuperLyricPush
import com.hchen.superlyricapi.SuperLyricTool
import expo.modules.orpheus.model.LyricsLine

private const val TAG = "SuperLyricBackend"

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
        Log.d(TAG, "[setLyrics] cached ${lyrics.size} lines")
    }

    override fun updateTime(seconds: Double) {
        if (!SuperLyricTool.isEnabled) {
            val now = System.currentTimeMillis()
            if (now - lastSkipLogTime > 5000) {
                Log.w(TAG, "[updateTime] SKIP: SuperLyric NOT active at ${seconds}s")
                lastSkipLogTime = now
            }
            return
        }

        if (lastLyrics.isEmpty()) {
            val now = System.currentTimeMillis()
            if (now - lastSkipLogTime > 2000) {
                Log.d(TAG, "[updateTime] SKIP: lyrics empty at ${seconds}s")
                lastSkipLogTime = now
            }
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
        val delayMs = if (index + 1 < lastLyrics.size) {
            ((lastLyrics[index + 1].timestamp - line.timestamp) * 1000).toInt()
        } else {
            0
        }

        val translation = line.translations?.getOrNull(0)
        Log.d(TAG, "[sendLine] line[$index/${lastLyrics.size - 1}] pos=${seconds}s adj=${adjustedTime}s delay=${delayMs}ms | \"${line.text}\"")

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
        } catch (e: Exception) {
            Log.e(TAG, "[sendLine] FAILED: ${e.message}", e)
        }
    }

    override fun setPlaybackState(isPlaying: Boolean) {
        if (isPlaying && lastLineIndex >= 0) {
            // Re-send current line on resume to ensure it's visible
            sendLineToSuperLyric(lastLineIndex, 0.0, 0.0)
        }
    }

    override fun onStop() {
        lastLyrics = emptyList()
        lastLineIndex = -1
        lastSkipLogTime = 0L

        if (!SuperLyricTool.isEnabled) {
            Log.d(TAG, "[onStop] skipped: SuperLyric not active")
            return
        }

        val data = SuperLyricData().setPackageName(context.packageName)
        try {
            SuperLyricPush.onStop(data)
            Log.d(TAG, "[onStop] onStop sent OK pkg=${context.packageName}")
        } catch (e: Exception) {
            Log.e(TAG, "[onStop] FAILED: ${e.message}", e)
        }
    }
}
