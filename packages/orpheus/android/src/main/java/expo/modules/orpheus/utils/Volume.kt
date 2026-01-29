package expo.modules.orpheus.utils

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.pow

/**
 * 响度均衡计算
 * @param measuredI 实测响度
 * @param targetI 目标响度
 * @return gain
 */
fun calculateLoudnessGain(measuredI: Double, targetI: Double = -14.0): Float {

    if (measuredI == 0.0) {
        return 1.0f
    }

    val gainDb = targetI - measuredI
    val linearFactor = 10.0.pow(gainDb / 20.0).toFloat()

    val finalResult = linearFactor.coerceIn(0.0f, 1.0f)

    return finalResult
}

/**
 * Volume Fade In
 * @param targetVolume 最终要达到的音量
 * @param durationMs 淡入持续时间
 * @param scope 协程作用域
 */
fun androidx.media3.common.Player.fadeInTo(
    targetVolume: Float,
    durationMs: Long = 600L,
    scope: CoroutineScope
): Job {
    this.volume = 0f

    return scope.launch {
        val stepInterval = 16L
        val steps = (durationMs / stepInterval).toInt()
        val volumeStep = targetVolume / steps

        for (i in 1..steps) {
            val newVol = volumeStep * i
            val finalVol = newVol.coerceAtMost(targetVolume)
            Log.d("Loudness", "finalVol $finalVol")
            volume = finalVol
            delay(stepInterval)
        }
        volume = targetVolume
    }
}