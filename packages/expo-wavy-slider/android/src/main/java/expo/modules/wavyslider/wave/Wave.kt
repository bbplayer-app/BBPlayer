/*
 * Wave drawing adapted from mahozad/wavy-slider 2.2.0 (Apache-2.0).
 * Copyright Mahdi Hosseinzadeh and contributors.
 * See android/third-party/wavy-slider/ for source and license details.
 */
package expo.modules.wavyslider.wave

import androidx.compose.animation.core.*
import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.coerceAtLeast
import androidx.compose.ui.unit.dp
import expo.modules.wavyslider.wave.WaveDirection.TAIL
import kotlin.math.PI
import kotlin.math.absoluteValue
import kotlin.math.sin

/**
 * The horizontal movement (shift) of the whole wave.
 */
enum class WaveDirection(internal val factor: (LayoutDirection) -> Float) {
    /**
     * Always shift toward left (regardless of layout direction).
     */
    LEFT(factor = { if (it == LayoutDirection.Ltr) 1f else -1f }),
    /**
     * Always shift toward right (regardless of layout direction).
     */
    RIGHT(factor = { if (it == LayoutDirection.Ltr) -1f else 1f }),
    /**
     * Shift toward the start (depends on layout direction).
     */
    TAIL(factor = { 1f }),
    /**
     * Shift toward the thumb (depends on layout direction).
     */
    HEAD(factor = { -1f })
}

/**
 * Custom animation configurations for various properties of the wave.
 *
 * @param waveHeightAnimationSpec used for **changes** in wave height.
 * @param waveVelocityAnimationSpec used for **changes** in wave velocity (whether in speed or direction).
 * @param waveAppearanceAnimationSpec Used for wave spread/expansion at the start of the composition.
 */
/*
 * This class enables clients of library to specify custom animation specs for changes in certain properties.
 * This way, they do not have to animate those properties themselves (for example, using animateDpAsState()).
 * More importantly, it enables us to provide a default animation for changes of those properties even
 * if client of library is not aware or does not care about making the changes animated/graceful/gradual.
 * If they want to make the changes immediate/abrupt/sudden, they can simply pass a snap() animation spec.
 */
data class WaveAnimationSpecs(
    /**
     * Used for **changes** in wave height.
     */
    val waveHeightAnimationSpec: AnimationSpec<Dp>,
    /**
     * Used for **changes** in wave velocity (whether in speed or direction).
     */
    val waveVelocityAnimationSpec: AnimationSpec<Dp>,
    /**
     * Used for wave spread/expansion at the start of the composition.
     */
    val waveAppearanceAnimationSpec: AnimationSpec<Float>,
)

/**
 * A better and more clear type name for wave velocity.
 *
 * This improves code readability for function parameters or variable declarations.
 * For example:
 * ```kotlin
 * import ir.mahozad.multiplatform.wavyslider.WaveVelocity
 *
 * fun doSomething(
 *  // velocity: Pair<Dp, WaveDirection>
 *     velocity: WaveVelocity
 * ) {
 *  // var newVelocity: Pair<Dp, WaveDirection>? = null
 *     var newVelocity: WaveVelocity? = null
 *     newVelocity = 10.dp to TAIL // OR WaveVelocity(10.dp, TAIL)
 * }
 * ```
 */
/*
 * For wave velocity, the existing "Pair" class of Kotlin stdlib is used along with the below alias for it.
 * As an example, Ktor has also done this kind of thing pervasively:
 *   https://github.com/search?q=repo%3Aktorio%2Fktor%20public%20typealias&type=code
 * A benefit of using "Pair" is that in Kotlin, any object (including "Dp") has the infix extension function "to"
 * which makes it easy and more readable to create "Pair"s (including creating instances of our wave velocity).
 * Another alternative implementation would be the following:
 *   data class WaveVelocity(val speed: Dp, val direction: WaveDirection)
 *   infix fun Dp.to/* OR toward */(that: WaveDirection) = WaveVelocity(this, that)
 * Advantages would be that instead of waveVelocity.first/.second, waveVelocity.speed/.direction could be used,
 * and it would probably make it easier to change only one property of the default wave velocity (using copy method).
 * Downsides would be that in addition to importing ir.mahozad.multiplatform.wavyslider.WaveVelocity,
 * the client of library would also have to import ir.mahozad.multiplatform.wavyslider.to/toward
 * and the IDE completion on "Dp" would be polluted by our new "to/toward" function
 * even if the client wanted to access something else on "Dp".
 * Note that we could have just omitted declaring this. In that case, if the clients wanted to
 * improve their code readability, they could have introduced this alias themselves.
 * But, our own code has also used this alias. So, keeping it seems a good idea.
 */
typealias WaveVelocity = Pair<Dp, WaveDirection>

private val wavyPath = Path()
internal val defaultIncremental = false
internal val defaultWaveLength = 20.dp
internal val defaultWaveHeight = 6.dp
internal val defaultWaveVelocity = 10.dp to TAIL
internal val defaultWaveAnimationSpecs = WaveAnimationSpecs(
    waveHeightAnimationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing),
    waveVelocityAnimationSpec = tween(durationMillis = 2000, easing = LinearOutSlowInEasing),
    waveAppearanceAnimationSpec = tween(durationMillis = 6000, easing = EaseOutQuad)
)

/**
 * As a sidenote, speed of a wave follows the equation
 * speed (m/s) = frequency (1/s) × wavelength (m)
 * v = f × λ
 * Also, frequency is the inverse of period (time it takes for one wavelength to pass).
 */
@Composable
internal inline fun animateWaveShift(
    waveVelocity: WaveVelocity,
    animationSpec: AnimationSpec<Dp>,
    visible: Boolean = true,
): State<Dp> {
    val shift = remember { mutableStateOf(0.dp) }
    val speed = waveVelocity.first.coerceAtLeast(0.dp)
    val factor = waveVelocity.second.factor(LocalLayoutDirection.current)
    val amount by animateDpAsState(speed * factor, animationSpec)
    val currentAmount = rememberUpdatedState(amount)
    val moving = visible && amount != 0.dp
    LaunchedEffect(moving) {
        if (!moving) return@LaunchedEffect
        var previousTime = withFrameNanos { it }
        while (true /* Android itself uses true instead of isActive */) {
            val time = withFrameNanos { it }
            val elapsed = (time - previousTime) / 1_000_000_000f
            shift.value += currentAmount.value * elapsed
            previousTime = time
        }
    }
    return shift
}

@Composable
internal inline fun animateWaveHeight(
    waveHeight: Dp,
    animationSpec: AnimationSpec<Dp>
): State<Dp> = animateDpAsState(
    targetValue = waveHeight,
    animationSpec = animationSpec
)

@Composable
internal inline fun animateWaveSpread(
    animationSpec: AnimationSpec<Float>
): State<Float> {
    var spreadFactor by remember { mutableFloatStateOf(0f) }
    val spreadFactorAnimated = animateFloatAsState(
        targetValue = spreadFactor,
        animationSpec = animationSpec
    )
    LaunchedEffect(Unit) { spreadFactor = 1f }
    return spreadFactorAnimated
}

internal inline fun DrawScope.createWavyPath(
    startOffset: Offset,
    valueOffset: Offset,
    waveLength: Dp,
    waveHeight: Dp,
    waveSpread: Float,
    waveShift: Dp,
    incremental: Boolean
): Path = wavyPath.apply {
    rewind()
    val waveShiftPx = waveShift.toPx()
    val waveLengthPx = waveLength.toPx()
    val waveHeightPx = waveHeight.toPx().absoluteValue
    val startRadians = waveSpread * waveShiftPx / waveLengthPx * (2 * PI)
    val startHeightFactor = if (incremental) 0f else 1f
    val startY = (sin(startRadians) * startHeightFactor * waveHeightPx + size.height) / 2
    moveTo(startOffset.x, startY.toFloat())
    val range = startOffset.x.toInt()..valueOffset.x.toInt()
    for (x in range) {
        val heightFactor = if (incremental) {
            if (range.first == range.last) 0f else (x - range.first).toFloat() / (range.last - range.first)
        } else 1f
        val radians = waveSpread * (x - range.first + waveShiftPx) / waveLengthPx * (2 * PI)
        val y = (sin(radians) * heightFactor * waveHeightPx + size.height) / 2
        lineTo(x.toFloat(), y.toFloat())
    }
}

// Scale x1 from a1..b1 range to a2..b2 range
internal inline fun scale(a1: Float, b1: Float, x1: Float, a2: Float, b2: Float) =
    lerp(a2, b2, calcFraction(a1, b1, x1))

internal inline fun lerp(start: Float, stop: Float, fraction: Float) =
    (start * (1 - fraction) + stop * fraction)

// Calculate the 0..1 fraction that `pos` value represents between `a` and `b`
internal inline fun calcFraction(a: Float, b: Float, pos: Float) =
    (if (b - a == 0f) 0f else (pos - a) / (b - a)).coerceIn(0f, 1f)
