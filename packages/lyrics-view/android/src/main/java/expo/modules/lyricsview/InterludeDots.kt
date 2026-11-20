package expo.modules.lyricsview

import androidx.compose.animation.core.CubicBezierEasing
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToLong
import kotlin.math.sin

/** 间奏点在某一时刻的外观 */
internal class InterludeDotsFrame {
    var opacity = 0f
    var scale = 1f
    val dotOpacities = FloatArray(InterludeDotsTimeline.DOT_COUNT)
}

/**
 * 间奏点的演出时间轴，移植自 AMLL 的 InterludeDotsBase：
 * 入场淡入 -> 三颗圆点依次点亮并整体呼吸缩放 -> 放大蓄力后缩小退场。
 * 整个演出只由「距演出锚点的经过时间」决定，便于逐帧直接求值。
 */
internal class InterludeDotsTimeline(
    startMs: Long,
    endMs: Long,
    /** 演出锚点：正常进入时为间奏开始时间，跳转进入时为跳转后的时间 */
    private val anchorMs: Long,
    private val delayEndMs: Long,
) {
    private var isPerforming = false
    private var isBreathing = false
    private var bodyEndMs = 0L
    private var totalEndMs = 0L
    private var breathePeriodMs = BREATHE_BASE_PERIOD_MS.toDouble()
    private var segmentMs = 0L
    private var dot3DurationMs = 0L
    private var dot3Target = 1f

    init {
        val remainingMs = max(0L, endMs - anchorMs)
        val bodyMs = remainingMs - delayEndMs - EXIT_TOTAL_MS
        // 连进退场都不足以支撑时不显示
        if (bodyMs >= DOT_ENTER_TOTAL_MS) {
            isPerforming = true
            bodyEndMs = delayEndMs + bodyMs
            totalEndMs = bodyEndMs + EXIT_TOTAL_MS
            if (bodyMs < FALLBACK_HOLD_THRESHOLD_MS) {
                dot3Target = 1f
            } else {
                isBreathing = true
                val cycles = max(1.0, floor(bodyMs.toDouble() / BREATHE_BASE_PERIOD_MS))
                breathePeriodMs = bodyMs / cycles
                segmentMs = ((bodyMs + DOT3_TRAILING_MS) / DOT_COUNT.toDouble()).roundToLong()
                dot3DurationMs = bodyMs - segmentMs * 2
                dot3Target = dot3DurationMs.toFloat() / segmentMs
            }
        }
        check(startMs <= endMs)
    }

    /** 是否有足够时长演出，不足时焦点应顺延到下一行 */
    val canDisplay: Boolean get() = isPerforming

    fun resolve(timeMs: Long, out: InterludeDotsFrame) {
        val elapsedMs = timeMs - anchorMs
        if (!isPerforming || elapsedMs >= totalEndMs || elapsedMs < delayEndMs) {
            out.opacity = 0f
            out.scale = 1f
            out.dotOpacities.fill(0f)
            return
        }

        val internalMs = elapsedMs - delayEndMs

        if (elapsedMs >= bodyEndMs) {
            val exitElapsedMs = elapsedMs - bodyEndMs
            val fadeT = clamp01((exitElapsedMs - (EXIT_TOTAL_MS - EXIT_FADE_MS)).toFloat() / EXIT_FADE_MS)
            out.opacity = enterOpacity(internalMs) * (1f - ExitFadeEasing.transform(fadeT))
            out.scale = if (exitElapsedMs < EXIT_PHASE1_MS) {
                1f + ExitPhase1Easing.transform(exitElapsedMs.toFloat() / EXIT_PHASE1_MS) * (BREATHE_MAX_SCALE - 1f)
            } else {
                val t = clamp01((exitElapsedMs - EXIT_PHASE1_MS).toFloat() / EXIT_PHASE2_MS)
                BREATHE_MAX_SCALE - ExitPhase2Easing.transform(t) * (BREATHE_MAX_SCALE - BREATHE_MIN_SCALE)
            }
            val trailing = clamp01(exitElapsedMs.toFloat() / DOT3_TRAILING_MS)
            writeDotOpacities(internalMs, 1f, 1f, dot3Target + (1f - dot3Target) * trailing, out)
            return
        }

        out.opacity = enterOpacity(internalMs)
        if (!isBreathing) {
            out.scale = 1f
            writeDotOpacities(internalMs, 1f, 1f, 1f, out)
            return
        }

        val cycleT = ((internalMs % breathePeriodMs) / breathePeriodMs).toFloat()
        val progress = breathingProgress(cycleT)
        out.scale = if (progress <= 0.5f) {
            1f + (progress / 0.5f) * (BREATHE_MAX_SCALE - 1f)
        } else {
            BREATHE_MAX_SCALE - ((progress - 0.5f) / 0.5f) * (BREATHE_MAX_SCALE - 1f)
        }
        writeDotOpacities(
            internalMs,
            dotFraction(0, segmentMs, internalMs, 1f),
            dotFraction(segmentMs, segmentMs, internalMs, 1f),
            dotFraction(segmentMs * 2, dot3DurationMs, internalMs, dot3Target),
            out,
        )
    }

    private fun writeDotOpacities(internalMs: Long, f0: Float, f1: Float, f2: Float, out: InterludeDotsFrame) {
        out.dotOpacities[0] = dotOpacity(f0) * dotEnterAlpha(0, internalMs)
        out.dotOpacities[1] = dotOpacity(f1) * dotEnterAlpha(1, internalMs)
        out.dotOpacities[2] = dotOpacity(f2) * dotEnterAlpha(2, internalMs)
    }

    companion object {
        /** 正常进入间奏时的入场等待；首行之前的间奏不等待 */
        const val ENTER_HOLD_MS = 500L
        const val DOT_COUNT = 3

        private const val DOT3_TRAILING_MS = 750L
        private const val EXIT_PHASE1_MS = 750L
        private const val EXIT_PHASE2_MS = 250L
        private const val EXIT_TOTAL_MS = EXIT_PHASE1_MS + EXIT_PHASE2_MS
        private const val EXIT_FADE_MS = 250L
        private const val ENTER_FADE_MS = 180L
        private const val DOT_ENTER_FADE_MS = 750L
        private const val DOT_ENTER_STAGGER_MS = 80L
        private const val DOT_ENTER_TOTAL_MS = (DOT_COUNT - 1) * DOT_ENTER_STAGGER_MS + DOT_ENTER_FADE_MS
        private const val BREATHE_BASE_PERIOD_MS = 4000L
        private const val FALLBACK_HOLD_THRESHOLD_MS = 3000L
        private const val BREATHE_MAX_SCALE = 1.25f
        private const val BREATHE_MIN_SCALE = 0.4f
        private const val DOT_INACTIVE_OPACITY = 0.2f
        private const val DOT_ACTIVE_OPACITY = 0.9f

        private val LightingEasing = CubicBezierEasing(0.56f, 0.01f, 0.45f, 1f)
        private val EnterFadeEasing = CubicBezierEasing(0.59f, 0.02f, 0.07f, 1f)
        private val ExitPhase1Easing = CubicBezierEasing(0.14f, 0.06f, 0.25f, 1f)
        private val ExitPhase2Easing = CubicBezierEasing(0.29f, 0.03f, 1f, 0.38f)
        private val ExitFadeEasing = CubicBezierEasing(0.43f, 0.08f, 0.83f, 0.31f)

        private fun breathingProgress(t: Float): Float {
            if (t <= 0f) return 0f
            if (t >= 1f) return 1f
            val angle = 4.0 * PI * t
            val s = sin(angle)
            val c = cos(angle)
            return (t - 0.084 * s + 0.008 * (1 - c) + 0.0046 * s * (c - s)).toFloat()
        }

        private fun dotOpacity(fraction: Float): Float =
            DOT_INACTIVE_OPACITY + (DOT_ACTIVE_OPACITY - DOT_INACTIVE_OPACITY) * clamp01(fraction)

        private fun enterOpacity(internalMs: Long): Float =
            EnterFadeEasing.transform(clamp01(internalMs.toFloat() / ENTER_FADE_MS))

        private fun dotEnterAlpha(index: Int, internalMs: Long): Float {
            val t = clamp01((internalMs - index * DOT_ENTER_STAGGER_MS).toFloat() / DOT_ENTER_FADE_MS)
            return t * t
        }

        private fun dotFraction(startDelay: Long, duration: Long, internalMs: Long, target: Float): Float {
            if (internalMs <= startDelay) return 0f
            val localT = (internalMs - startDelay).toFloat() / duration
            return LightingEasing.transform(clamp01(localT)) * target
        }
    }
}

internal fun clamp01(value: Float): Float = value.coerceIn(0f, 1f)
