package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import com.hchen.superlyricapi.SuperLyricData
import com.hchen.superlyricapi.SuperLyricPush
import com.hchen.superlyricapi.SuperLyricTool
import expo.modules.orpheus.model.LyricsLine

private const val TAG = "StatusBarLyrics"

class StatusBarLyricsManager(private val context: Context) {

    var enabled: Boolean = false
        set(value) {
            val prev = field
            field = value
            Log.d(TAG, "[enabled] $prev -> $value | superLyricActive=${SuperLyricTool.isEnabled}")
            if (prev && !value) {
                pushStop()
            }
        }

    private var lyrics: List<LyricsLine> = emptyList()
    private var offset: Double = 0.0
    private var currentLineIndex: Int = -1
    private var lastSkipLogTime: Long = 0L

    fun setLyrics(newLyrics: List<LyricsLine>, newOffset: Double = 0.0) {
        val firstLine = newLyrics.firstOrNull()?.text ?: "(none)"
        Log.d(TAG, "[setLyrics] count=${newLyrics.size} offset=$newOffset | enabled=$enabled superLyricActive=${SuperLyricTool.isEnabled} | first=\"$firstLine\"")
        lyrics = newLyrics.sortedBy { it.timestamp }
        offset = newOffset
        currentLineIndex = -1
    }

    fun updateTime(seconds: Double) {
        if (!enabled) return

        if (!SuperLyricTool.isEnabled) {
            val now = System.currentTimeMillis()
            if (now - lastSkipLogTime > 5000) {
                Log.w(TAG, "[updateTime] SKIP: SuperLyric NOT active at ${seconds}s")
                lastSkipLogTime = now
            }
            return
        }

        if (lyrics.isEmpty()) {
            val now = System.currentTimeMillis()
            if (now - lastSkipLogTime > 2000) {
                Log.d(TAG, "[updateTime] SKIP: lyrics empty at ${seconds}s (currentLineIndex=$currentLineIndex)")
                lastSkipLogTime = now
            }
            return
        }

        lastSkipLogTime = 0L

        val adjustedTime = seconds - offset
        val index = lyrics.indexOfLast { it.timestamp <= adjustedTime }

        if (index < 0 || index == currentLineIndex) return

        val line = lyrics[index]
        val delayMs = if (index + 1 < lyrics.size) {
            ((lyrics[index + 1].timestamp - line.timestamp) * 1000).toInt()
        } else {
            0
        }

        Log.d(TAG, "[updateTime] line[$index/${lyrics.size - 1}] pos=${seconds}s adj=${adjustedTime}s delay=${delayMs}ms | \"${line.text}\"" +
                if (!line.translation.isNullOrEmpty()) " / \"${line.translation}\"" else "")

        currentLineIndex = index

        val data = SuperLyricData()
            .setLyric(line.text)
            .setPackageName(context.packageName)
            .setDelay(delayMs)

        if (!line.translation.isNullOrEmpty()) {
            data.setTranslation(line.translation)
        }

        try {
            SuperLyricPush.onSuperLyric(data)
            Log.d(TAG, "[updateTime] onSuperLyric sent OK")
        } catch (e: Exception) {
            Log.e(TAG, "[updateTime] onSuperLyric FAILED: ${e.message}", e)
        }
    }

    fun onStop() {
        Log.d(TAG, "[onStop] had ${lyrics.size} lines lastIndex=$currentLineIndex | enabled=$enabled superLyricActive=${SuperLyricTool.isEnabled}")
        lyrics = emptyList()
        currentLineIndex = -1
        lastSkipLogTime = 0L
        pushStop()
    }

    private fun pushStop() {
        if (!SuperLyricTool.isEnabled) {
            Log.d(TAG, "[pushStop] skipped: SuperLyric not active")
            return
        }

        val data = SuperLyricData()
            .setPackageName(context.packageName)

        try {
            SuperLyricPush.onStop(data)
            Log.d(TAG, "[pushStop] onStop sent OK pkg=${context.packageName}")
        } catch (e: Exception) {
            Log.e(TAG, "[pushStop] FAILED: ${e.message}", e)
        }
    }
}
