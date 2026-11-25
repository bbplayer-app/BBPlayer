package expo.modules.orpheus.util

import kotlin.math.pow

/** B 站的 target_i 固定是 -14 */
const val LOUDNESS_TARGET_LUFS = -14.0

/** 提升音量时真峰值不超过这个值（dBTP） */
const val TRUE_PEAK_CEILING_DBTP = -1.0

/**
 * 响度均衡的增益（dB）。
 *
 * 太响的歌直接降到目标响度。太轻的歌要提升，但提升后真峰值不能超过 [TRUE_PEAK_CEILING_DBTP]，
 * 所以提升量受峰值余量限制；没有真峰值数据时不提升。
 *
 * @param measuredI 实测响度（LUFS），0 表示没有数据
 * @param measuredTp 实测真峰值（dBTP），null 表示没有数据
 */
fun calculateLoudnessGainDb(measuredI: Double, measuredTp: Double?): Double {
    if (measuredI == 0.0 || !measuredI.isFinite()) return 0.0
    val gainDb = LOUDNESS_TARGET_LUFS - measuredI
    if (gainDb <= 0.0) return gainDb
    val headroomDb = measuredTp?.takeIf { it.isFinite() }?.let { TRUE_PEAK_CEILING_DBTP - it } ?: return 0.0
    return gainDb.coerceAtMost(headroomDb.coerceAtLeast(0.0))
}

fun dbToLinear(db: Double): Float = 10.0.pow(db / 20.0).toFloat()
