package expo.modules.orpheus.utils

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.Player

class SleepTimeController(private val player: Player) {

    private val handler = Handler(Looper.getMainLooper())

    private var internalStopTargetMs: Long? = null

    private val stopRunnable = Runnable {
        performStop()
    }

    /**
     * 开启定时器
     * @param durationMs 多少毫秒后停止
     */
    fun start(durationMs: Long) {
        if (durationMs <= 0) {
            cancel()
            return
        }

        cancel()

        internalStopTargetMs = SystemClock.elapsedRealtime() + durationMs

        handler.postDelayed(stopRunnable, durationMs)
    }

    /**
     * 取消定时器
     */
    fun cancel() {
        internalStopTargetMs = null
        handler.removeCallbacks(stopRunnable)
    }

    /**
     * @return 返回的是标准的 UTC 时间戳 (System.currentTimeMillis 格式)，如果没开启则返回 null
     */
    fun getStopTimeMs(): Long? {
        val target = internalStopTargetMs ?: return null
        val nowElapsed = SystemClock.elapsedRealtime()

        val remainingMs = target - nowElapsed

        if (remainingMs <= 0) {
            return null
        }

        return System.currentTimeMillis() + remainingMs
    }

    private fun performStop() {
        player.pause()
        cancel()
    }
}