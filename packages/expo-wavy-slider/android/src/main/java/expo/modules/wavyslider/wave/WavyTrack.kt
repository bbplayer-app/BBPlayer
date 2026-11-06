/*
 * Wave drawing adapted from mahozad/wavy-slider 2.2.0 (Apache-2.0).
 * Copyright Mahdi Hosseinzadeh and contributors.
 * See android/third-party/wavy-slider/ for source and license details.
 */
package expo.modules.wavyslider.wave

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.*
import kotlin.math.absoluteValue
import kotlin.math.max
import kotlin.math.roundToInt

/** Waveform-only adapter: no Material 3 SliderState or internal Material APIs. */
@Composable
internal fun WavyTrack(
    valueFraction: Float,
    thumbWidth: Dp,
    activeTrackColor: Color,
    inactiveTrackColor: Color,
    waveLength: Dp,
    waveHeight: Dp,
    waveVelocity: WaveVelocity,
    waveThickness: Dp,
    trackThickness: Dp,
    incremental: Boolean,
    animationSpecs: WaveAnimationSpecs,
) {
    val waveSpreadAnimated by animateWaveSpread(animationSpecs.waveAppearanceAnimationSpec)
    val waveHeightAnimated by animateWaveHeight(waveHeight, animationSpecs.waveHeightAnimationSpec)
    val waveShiftAnimated by animateWaveShift(
        waveVelocity,
        animationSpecs.waveVelocityAnimationSpec,
        visible = waveLength > 0.dp && waveHeightAnimated != 0.dp,
    )
    Canvas(
        Modifier.fillMaxWidth()
            .height(max(waveThickness + waveHeight.value.absoluteValue.dp, 44.dp))
            .rotate(if (LocalLayoutDirection.current == LayoutDirection.Rtl) 180f else 0f)
    ) {
        val start = Offset(0f, center.y)
        val end = Offset(size.width, center.y)
        drawTrack(
            sliderStart = start,
            sliderValueOffset = Offset(size.width * valueFraction.coerceIn(0f, 1f), center.y),
            sliderEnd = end,
            waveLength = waveLength,
            waveHeight = waveHeightAnimated,
            waveSpread = waveSpreadAnimated,
            waveShift = waveShiftAnimated,
            waveThickness = waveThickness,
            trackThickness = trackThickness,
            incremental = incremental,
            inactiveTrackColor = inactiveTrackColor,
            activeTrackColor = activeTrackColor,
            thumbWidth = thumbWidth,
            thumbTrackGapSize = 6.dp,
            trackInsideCornerSize = 2.dp,
            drawStopIndicator = { offset ->
                drawCircle(color = activeTrackColor, radius = 2.dp.toPx(), center = offset)
            },
        )
    }
}

// This is named trackPath in the original compose-multiplatform-core code
private val inactiveTrackPath = Path()

private inline fun DrawScope.drawTrack(
    sliderStart: Offset,
    sliderValueOffset: Offset,
    sliderEnd: Offset,
    waveLength: Dp,
    waveHeight: Dp,
    waveSpread: Float,
    waveShift: Dp,
    waveThickness: Dp,
    trackThickness: Dp,
    incremental: Boolean,
    inactiveTrackColor: Color,
    activeTrackColor: Color,

    thumbWidth: Dp,
    thumbTrackGapSize: Dp,
    trackInsideCornerSize: Dp,
    noinline drawStopIndicator: (DrawScope.(Offset) -> Unit)?
) {
    drawTrackActivePart(
        startOffset = sliderStart,
        valueOffset = sliderValueOffset,
        waveLength = waveLength,
        waveHeight = waveHeight,
        waveSpread = waveSpread,
        waveShift = waveShift,
        waveThickness = waveThickness,
        incremental = incremental,
        color = activeTrackColor,
        thumbWidth = thumbWidth,
        thumbTrackGapSize = thumbTrackGapSize,
        trackInsideCornerSize = trackInsideCornerSize
    )
    drawTrackInactivePart(
        color = inactiveTrackColor,
        thickness = trackThickness,
        startOffset = sliderValueOffset,
        endOffset = sliderEnd,
        thumbWidth = thumbWidth,
        thumbTrackGapSize = thumbTrackGapSize,
        trackInsideCornerSize = trackInsideCornerSize,
        drawStopIndicator = drawStopIndicator
    )
}

private inline fun DrawScope.drawTrackInactivePart(
    color: Color,
    thickness: Dp,
    startOffset: Offset,
    endOffset: Offset,
    thumbWidth: Dp,
    thumbTrackGapSize: Dp,
    trackInsideCornerSize: Dp,
    noinline drawStopIndicator: (DrawScope.(Offset) -> Unit)?
) {
    if (thickness <= 0.dp) return
    val cornerSize = thickness.toPx() / 2
    val insideCornerSize = trackInsideCornerSize.toPx()
    val endGap = if (thumbTrackGapSize > 0.dp) {
        (thumbWidth.toPx() / 2) + thumbTrackGapSize.toPx()
    } else {
        0f
    }
    val sliderEnd = endOffset.x - endGap
    if (startOffset.x < sliderEnd - cornerSize) {
        val start = startOffset.x + endGap
        val end = sliderEnd
        // Below code was actually in the drawTrackPath() function in the original CMP Slider
        /////////////////////////////////
        val startCorner = CornerRadius(insideCornerSize, insideCornerSize)
        val endCorner = CornerRadius(cornerSize, cornerSize)
        val track = RoundRect(
            rect = Rect(
                offset = Offset(start, center.y - thickness.toPx() / 2),
                size = Size(end - startOffset.x, thickness.toPx())
            ),
            topLeft = startCorner,
            topRight = endCorner,
            bottomRight = endCorner,
            bottomLeft = startCorner
        )
        inactiveTrackPath.addRoundRect(track)
        drawPath(inactiveTrackPath, color)
        inactiveTrackPath.rewind()
        /////////////////////////////////
        drawStopIndicator?.invoke(this, Offset(endOffset.x - cornerSize, center.y))
    }
}

private inline fun DrawScope.drawTrackActivePart(
    startOffset: Offset,
    valueOffset: Offset,
    waveLength: Dp,
    waveHeight: Dp,
    waveSpread: Float,
    waveShift: Dp,
    waveThickness: Dp,
    incremental: Boolean,
    color: Color,
    thumbWidth: Dp,
    thumbTrackGapSize: Dp,
    trackInsideCornerSize: Dp
) {
    if (waveThickness <= 0.dp) return
    val startCornerRadius = waveThickness.toPx() / 2
    val endGap = if (thumbTrackGapSize > 0.dp) {
        (thumbWidth.toPx() / 2) + thumbTrackGapSize.toPx()
    } else {
        0f
    }
    val endOffset = Offset(x = valueOffset.x - endGap, 0f)
    if (endOffset.x - startOffset.x > startCornerRadius) {
        if (waveLength <= 0.dp || waveHeight == 0.dp) {
            drawPath(
                path = createFlatPath(
                    startOffset,
                    endOffset,
                    waveThickness.toPx(),
                    startCornerRadius,
                    trackInsideCornerSize.toPx()
                ),
                color = color
            )
        } else {
            drawPath(
                path = createWavyPath(
                    // See the visual test #41 and its KDoc for more information.
                    startOffset.copy(x = (startOffset.x + waveThickness.toPx() / 2).roundToInt().toFloat()),
                    endOffset.copy(x = endOffset.x - waveThickness.toPx() / 2),
                    waveLength,
                    waveHeight,
                    waveSpread,
                    waveShift,
                    incremental
                ),
                color = color,
                style = Stroke(
                    width = waveThickness.toPx(),
                    join = StrokeJoin.Round,
                    cap = StrokeCap.Round
                )
            )
        }
    }
}

private inline fun DrawScope.createFlatPath(
    startOffset: Offset,
    valueOffset: Offset,
    thickness: Float,
    startCornerSize: Float,
    insideCornerSize: Float
): Path = Path().apply {
    val endCorner = CornerRadius(insideCornerSize, insideCornerSize)
    val startCorner = CornerRadius(startCornerSize, startCornerSize)
    addRoundRect(
        RoundRect(
            left = startOffset.x,
            right = valueOffset.x,
            top = center.y - thickness / 2,
            bottom = center.y + thickness / 2,
            topLeftCornerRadius = startCorner,
            topRightCornerRadius = endCorner,
            bottomRightCornerRadius = endCorner,
            bottomLeftCornerRadius = startCorner
        )
    )
}
