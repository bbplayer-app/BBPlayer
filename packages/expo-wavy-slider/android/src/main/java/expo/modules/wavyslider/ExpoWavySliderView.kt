package expo.modules.wavyslider

import android.content.Context
import android.graphics.Color
import android.view.ViewGroup.LayoutParams
import android.widget.Space
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SliderDefaults
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ExpoView
import expo.modules.wavyslider.state.ObservableState
import expo.modules.wavyslider.state.WorkletCallback
import ir.mahozad.multiplatform.wavyslider.WaveDirection
import ir.mahozad.multiplatform.wavyslider.material3.Track
import ir.mahozad.multiplatform.wavyslider.material3.WaveAnimationSpecs
import ir.mahozad.multiplatform.wavyslider.material3.WavySlider

enum class WavySliderWaveDirection(val value: String) : Enumerable {
    LEFT("left"),
    RIGHT("right"),
    TAIL("tail"),
    HEAD("head");

    fun toWaveDirection(): WaveDirection = when (this) {
        LEFT -> WaveDirection.LEFT
        RIGHT -> WaveDirection.RIGHT
        TAIL -> WaveDirection.TAIL
        HEAD -> WaveDirection.HEAD
    }
}

@OptimizedRecord
class WavySliderColors : Record {
    @Field
    val thumbColor: Color? = null

    @Field
    val activeTrackColor: Color? = null

    @Field
    val inactiveTrackColor: Color? = null

    @Field
    val activeTickColor: Color? = null

    @Field
    val inactiveTickColor: Color? = null

    @Field
    val bufferedTrackColor: Color? = null
}

private fun colorToComposeColorOrNull(color: Color?): androidx.compose.ui.graphics.Color? {
    return color?.let {
        androidx.compose.ui.graphics.Color(it.red(), it.green(), it.blue(), it.alpha())
    }
}

private val Color?.compose: androidx.compose.ui.graphics.Color
    get() = colorToComposeColorOrNull(this) ?: androidx.compose.ui.graphics.Color.Unspecified

private val Color?.composeOrNull: androidx.compose.ui.graphics.Color?
    get() = colorToComposeColorOrNull(this)

private fun ObservableState.floatValue(fallback: Float): Float {
    return (value as? Number)?.toFloat() ?: fallback
}

private fun fractionInRange(start: Float, end: Float, value: Float): Float {
    if (end - start == 0f) return 0f
    return ((value - start) / (end - start)).coerceIn(0f, 1f)
}

// Matches Material 3 default Slider track gap: HandleWidth / 2 + ActiveHandleLeadingSpace.
private val BufferedThumbTrackGapSize = 8.dp
private val BufferedTrackInsideCornerSize = 2.dp

@OptIn(ExperimentalMaterial3Api::class)
class ExpoWavySliderView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    override val shouldUseAndroidLayout = true

    var value by mutableFloatStateOf(0.0f)
    var progress by mutableStateOf<ObservableState?>(null)
    var bufferedValue by mutableFloatStateOf(0.0f)
    var bufferedProgress by mutableStateOf<ObservableState?>(null)
    var min by mutableFloatStateOf(0.0f)
    var max by mutableFloatStateOf(1.0f)
    var lowerLimit by mutableStateOf<Float?>(null)
    var upperLimit by mutableStateOf<Float?>(null)
    var sliderEnabled by mutableStateOf(true)
    var colors by mutableStateOf(WavySliderColors())
    var waveLength by mutableFloatStateOf(16.0f)
    var waveLengthState by mutableStateOf<ObservableState?>(null)
    var waveHeight by mutableFloatStateOf(16.0f)
    var waveHeightState by mutableStateOf<ObservableState?>(null)
    var waveVelocity by mutableFloatStateOf(15.0f)
    var waveVelocityState by mutableStateOf<ObservableState?>(null)
    var waveDirection by mutableStateOf(WavySliderWaveDirection.HEAD)
    var waveThickness by mutableFloatStateOf(4.0f)
    var waveThicknessState by mutableStateOf<ObservableState?>(null)
    var trackThickness by mutableFloatStateOf(4.0f)
    var trackThicknessState by mutableStateOf<ObservableState?>(null)
    var incremental by mutableStateOf(false)
    var onValueChange by mutableStateOf<WorkletCallback?>(null)
    var onValueChangeFinished by mutableStateOf<WorkletCallback?>(null)
    var onDragStateChange by mutableStateOf<WorkletCallback?>(null)

    private var composeView: ComposeView? = null
    private val placeholderView = Space(context).also {
        it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        addView(it)
    }

    init {
        orientation = VERTICAL
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        ensureComposeView()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        val child = composeView ?: placeholderView
        child.measure(
            MeasureSpec.makeMeasureSpec(measuredWidth, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(measuredHeight, MeasureSpec.EXACTLY)
        )
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        val child = composeView ?: placeholderView
        child.layout(0, 0, right - left, bottom - top)
    }

    private fun ensureComposeView() {
        if (composeView != null) return

        removeAllViews()
        composeView = ComposeView(context).also { it ->
            it.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            it.setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
            addView(it)
            it.setContent {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    val interactionSource = remember { MutableInteractionSource() }
                    val isDragged by interactionSource.collectIsDraggedAsState()
                    val effectiveLower = maxOf(min, lowerLimit ?: Float.NEGATIVE_INFINITY)
                    val effectiveUpper = minOf(max, upperLimit ?: Float.POSITIVE_INFINITY)
                    val propsValue = progress?.floatValue(value) ?: value
                    val clampedPropsValue = propsValue.coerceIn(effectiveLower, effectiveUpper)
                    val bufferedPropsValue = bufferedProgress?.floatValue(bufferedValue) ?: bufferedValue
                    val clampedBufferedValue =
                        bufferedPropsValue.coerceIn(effectiveLower, effectiveUpper)
                    val effectiveWaveLength =
                        (waveLengthState?.floatValue(waveLength) ?: waveLength).dp
                    val effectiveWaveHeight =
                        (waveHeightState?.floatValue(waveHeight) ?: waveHeight).dp
                    val effectiveWaveVelocity =
                        (waveVelocityState?.floatValue(waveVelocity) ?: waveVelocity).dp
                    val effectiveWaveThickness =
                        (waveThicknessState?.floatValue(waveThickness) ?: waveThickness).dp
                    val effectiveTrackThickness =
                        (trackThicknessState?.floatValue(trackThickness) ?: trackThickness).dp
                    val animationSpecs = remember {
                        SliderDefaults.WaveAnimationSpecs.copy(
                            waveHeightAnimationSpec = tween(
                                durationMillis = 0
                            ),
                            waveAppearanceAnimationSpec = tween(
                                durationMillis = 0
                            )
                        )
                    }

                    LaunchedEffect(isDragged) {
                        onDragStateChange?.invoke(isDragged)
                    }

                    var localValue by remember { mutableFloatStateOf(clampedPropsValue) }
                    var isDragging by remember { mutableStateOf(false) }
                    var prevPropsValue by remember { mutableFloatStateOf(clampedPropsValue) }

                    if (clampedPropsValue != prevPropsValue) {
                        prevPropsValue = clampedPropsValue
                        if (!isDragging) {
                            localValue = clampedPropsValue
                        }
                    }

                    val sliderColors = SliderDefaults.colors(
                        thumbColor = colors.thumbColor.compose,
                        activeTrackColor = colors.activeTrackColor.compose,
                        inactiveTrackColor = colors.inactiveTrackColor.compose,
                        activeTickColor = colors.activeTickColor.compose,
                        inactiveTickColor = colors.inactiveTickColor.compose
                    )
                    val bufferedTrackColor = colors.bufferedTrackColor.composeOrNull

                    WavySlider(
                        value = localValue,
                        valueRange = min..max,
                        enabled = sliderEnabled,
                        interactionSource = interactionSource,
                        onValueChange = {
                            val clamped = it.coerceIn(effectiveLower, effectiveUpper)
                            isDragging = true
                            localValue = clamped
                            progress?.value = clamped
                            onValueChange?.invoke(clamped)
                        },
                        onValueChangeFinished = {
                            isDragging = false
                            progress?.value = localValue
                            onValueChangeFinished?.invoke(localValue)
                        },
                        colors = sliderColors,
                        waveLength = effectiveWaveLength,
                        waveHeight = effectiveWaveHeight,
                        waveVelocity = effectiveWaveVelocity to waveDirection.toWaveDirection(),
                        waveThickness = effectiveWaveThickness,
                        trackThickness = effectiveTrackThickness,
                        incremental = incremental,
                        animationSpecs = animationSpecs,
                        track = { sliderState ->
                            Box(modifier = Modifier.fillMaxWidth()) {
                                SliderDefaults.Track(
                                    colors = sliderColors,
                                    enabled = sliderEnabled,
                                    sliderState = sliderState,
                                    waveLength = effectiveWaveLength,
                                    waveHeight = effectiveWaveHeight,
                                    waveVelocity = effectiveWaveVelocity to waveDirection.toWaveDirection(),
                                    waveThickness = effectiveWaveThickness,
                                    trackThickness = effectiveTrackThickness,
                                    incremental = incremental,
                                    animationSpecs = animationSpecs
                                )
                                bufferedTrackColor?.let { color ->
                                    Canvas(modifier = Modifier.matchParentSize()) {
                                        val valueFraction = fractionInRange(
                                            min,
                                            max,
                                            sliderState.value.coerceIn(effectiveLower, effectiveUpper)
                                        )
                                        val bufferedFraction = fractionInRange(
                                            min,
                                            max,
                                            clampedBufferedValue
                                        )

                                        if (bufferedFraction > valueFraction) {
                                            val thicknessPx = effectiveTrackThickness.toPx()
                                            val thumbGapPx = BufferedThumbTrackGapSize.toPx()
                                            val startX = size.width * valueFraction + thumbGapPx
                                            val endX = size.width * bufferedFraction
                                            if (thicknessPx > 0f && endX > startX) {
                                                val insideCornerSize =
                                                    BufferedTrackInsideCornerSize.toPx()
                                                val innerCorner = CornerRadius(
                                                    insideCornerSize,
                                                    insideCornerSize
                                                )
                                                val outerCorner = CornerRadius(
                                                    thicknessPx / 2,
                                                    thicknessPx / 2
                                                )
                                                val bufferedTrackPath = Path().apply {
                                                    addRoundRect(
                                                        RoundRect(
                                                            rect = Rect(
                                                                offset = Offset(
                                                                    startX,
                                                                    center.y - thicknessPx / 2
                                                                ),
                                                                size = Size(endX - startX, thicknessPx)
                                                            ),
                                                            topLeft = innerCorner,
                                                            bottomLeft = innerCorner,
                                                            topRight = outerCorner,
                                                            bottomRight = outerCorner
                                                        )
                                                    )
                                                }
                                                drawPath(
                                                    path = bufferedTrackPath,
                                                    color = color
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
        requestLayout()
    }
}
