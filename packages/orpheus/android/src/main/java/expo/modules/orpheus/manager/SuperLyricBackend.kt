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

    private var lyrics: List<LyricsLine> = emptyList()
    private var offset: Double = 0.0
    private var currentLineIndex: Int = -1
    private var lastSkipLogTime: Long = 0L

    override fun setLyrics(lyrics: List<LyricsLine>, offset: Double) {
        this.lyrics = lyrics
        this.offset = offset
        currentLineIndex = -1
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

        if (lyrics.isEmpty()) {
            val now = System.currentTimeMillis()
            if (now - lastSkipLogTime > 2000) {
                Log.d(TAG, "[updateTime] SKIP: lyrics empty at ${seconds}s")
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

        val translation = line.translations?.getOrNull(0)
        Log.d(TAG, "[updateTime] line[$index/${lyrics.size - 1}] pos=${seconds}s adj=${adjustedTime}s delay=${delayMs}ms | \"${line.text}\"" +
                if (!translation.isNullOrEmpty()) " / \"$translation\"" else "")

        currentLineIndex = index

        val data = SuperLyricData()
            .setLyric(line.text)
            .setPackageName(context.packageName)
            .setDelay(delayMs)

        if (!translation.isNullOrEmpty()) {
            data.setTranslation(translation)
        }

        try {
            SuperLyricPush.onSuperLyric(data)
            Log.d(TAG, "[updateTime] onSuperLyric sent OK")
        } catch (e: Exception) {
            Log.e(TAG, "[updateTime] onSuperLyric FAILED: ${e.message}", e)
        }
    }

    override fun onStop() {
        lyrics = emptyList()
        currentLineIndex = -1
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
