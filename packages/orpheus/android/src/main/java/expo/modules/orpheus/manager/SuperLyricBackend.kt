package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import com.hchen.superlyricapi.SuperLyricData
import com.hchen.superlyricapi.SuperLyricPush
import com.hchen.superlyricapi.SuperLyricTool

private const val TAG = "SuperLyricBackend"

/**
 * SuperLyric implementation for status bar lyrics.
 * Simple line-by-line display protocol.
 */
class SuperLyricBackend(context: Context) : StatusBarLyricsBackend(context) {

    override val isAvailable: Boolean
        get() = SuperLyricTool.isEnabled

    private var lastFrame: StatusBarLyricFrame? = null

    override fun renderLyricFrame(frame: StatusBarLyricFrame?) {
        lastFrame = frame

        if (frame == null) {
            onStop()
            return
        }

        sendFrame(frame)
    }

    // SuperLyric is line-by-line; progress is ignored.
    override fun updateProgress(positionMs: Long) = Unit

    private fun sendFrame(frame: StatusBarLyricFrame) {
        if (!SuperLyricTool.isEnabled) return

        val line = frame.line
        val translation = line.translation ?: line.romaji
        val data = SuperLyricData()
            .setLyric(line.text)
            .setPackageName(context.packageName)
            .setDelay(frame.delayMs)

        if (!translation.isNullOrEmpty()) {
            data.setTranslation(translation)
        }

        try {
            SuperLyricPush.onSuperLyric(data)
            Log.d(TAG, "[render] text=\"${line.text}\" delay=${frame.delayMs}")
        } catch (e: Exception) {
            Log.e(TAG, "[render] Failed: ${e.message}")
        }
    }

    override fun setPlaybackState(isPlaying: Boolean) {
        if (isPlaying) {
            lastFrame?.let { frame ->
                sendFrame(
                    frame.copy(
                        delayMs = (frame.delayMs.toLong() - frame.lineProgressMs)
                            .coerceAtLeast(0L)
                            .toInt(),
                    ),
                )
            }
        }
    }

    override fun onStop() {
        lastFrame = null

        if (!SuperLyricTool.isEnabled) return

        try {
            SuperLyricPush.onStop(SuperLyricData().setPackageName(context.packageName))
        } catch (e: Exception) {
            Log.e(TAG, "[onStop] Failed: ${e.message}")
        }
    }
}
