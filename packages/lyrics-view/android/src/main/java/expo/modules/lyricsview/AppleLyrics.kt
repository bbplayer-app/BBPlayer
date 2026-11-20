package expo.modules.lyricsview

import android.os.Build
import android.os.SystemClock
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.exponentialDecay
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.LongState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

@Immutable
data class LyricsStyle(
    val color: Color,
    /** 主歌词字号（sp），不大于 0 时按视图宽度的 8% 自动计算 */
    val fontSize: Float,
    val fadeTop: Float,
    val fadeBottom: Float,
    val bottomInset: Float,
)

// 以下参数除特别说明外均取自 AMLL（github.com/amll-dev/applemusic-like-lyrics）

/** 焦点行的中心对齐到视口高度的 35% 处 */
private const val ALIGN_POSITION = 0.35f
private const val STAGGER_STEP_MS = 50.0
private const val INACTIVE_SCALE = 0.97f
private const val MAX_BLUR_DP = 5f
private const val NARROW_BLUR_FACTOR = 0.8f
private const val NARROW_VIEWPORT_DP = 1024f

/** 高亮行整组的不透明度；非逐字歌词的非高亮行整组压到 0.2 */
private const val ACTIVE_GROUP_ALPHA = 0.85f
private const val NON_DYNAMIC_INACTIVE_GROUP_ALPHA = 0.2f

/** 逐字歌词的明暗：非高亮 0.2，高亮行未唱部分 0.4、已唱部分 1 */
private const val DIM_ALPHA = 0.2f
private const val UNSUNG_ALPHA = 0.4f
private const val SUB_LINE_ALPHA = 0.3f
private const val HOVER_ALPHA = 0.067f

/** 渐变过渡宽度占单词高度的比例。AMLL 默认 0.5（iPad 效果），Apple Music Android 版约为 1 */
private const val WORD_FADE_WIDTH = 0.5f
private const val WORD_FLOAT_EM = 0.05f
private const val WORD_FLOAT_MIN_DURATION_MS = 1000f

private const val ACTIVATE_MS = 300
private const val DEACTIVATE_MS = 450
private const val BLUR_TRANSITION_MS = 400
private const val AUTO_ALIGN_RESUME_DELAY_MS = 500L
private const val OVERSCAN_DP = 300f
private const val MOTION_BUFFER_RATIO = 0.4f

/** 惯性每 1/60 秒衰减到 0.95，换算成 exponentialDecay 的摩擦系数 */
private val ScrollDecay = exponentialDecay<Float>(frictionMultiplier = 0.73f)

private val CssEase = CubicBezierEasing(0.25f, 0.1f, 0.25f, 1f)
private val CssEaseOut = CubicBezierEasing(0f, 0f, 0.58f, 1f)
private val EmphasisInEasing = CubicBezierEasing(0.2f, 0.4f, 0.58f, 1f)
private val EmphasisOutEasing = CubicBezierEasing(0.3f, 0f, 0.58f, 1f)

private val LinePadding = 20.dp

/** 质量 0.9 的弹簧换算成 Compose 的阻尼比与刚度（Compose 默认质量为 1） */
private fun massSpring(
    stiffness: Float,
    damping: Float,
    mass: Float = 0.9f,
    visibilityThreshold: Float = POSITION_VISIBILITY_THRESHOLD,
): AnimationSpec<Float> = spring(
    dampingRatio = damping / (2f * sqrt(stiffness * mass)),
    stiffness = stiffness / mass,
    visibilityThreshold = visibilityThreshold,
)

/**
 * 弹簧距离目标小于该值即视为到达并直接跳到终点。Compose 默认是 0.01，
 * 对 0.97 ~ 1 的缩放来说等于最后三分之一直接跳变，所以缩放要用更小的阈值
 */
private const val POSITION_VISIBILITY_THRESHOLD = 0.1f
private const val SCALE_VISIBILITY_THRESHOLD = 0.0001f

private val SlowPositionSpring = massSpring(90f, 15f)
private val ScaleSpring = massSpring(100f, 25f, mass = 2f, visibilityThreshold = SCALE_VISIBILITY_THRESHOLD)

/** 正常播放时按两行之间的时间间隔调整弹簧，间隔越短越快 */
private fun positionSpring(intervalMs: Long?): AnimationSpec<Float> {
    if (intervalMs == null) return SlowPositionSpring
    val clamped = intervalMs.coerceIn(100L, 800L).toFloat()
    val ratio = Math.pow((1f - (clamped - 100f) / 700f).toDouble(), 0.2).toFloat()
    val stiffness = 170f + ratio * 50f
    return massSpring(stiffness, sqrt(stiffness) * 2.2f)
}

/** 预先建好的模糊效果，按 0.5px 一档复用，避免每帧分配 */
private val BlurEffects: Array<RenderEffect?> = Array(65) { step ->
    if (step == 0) null else BlurEffect(step / 2f, step / 2f, TileMode.Decal)
}

private fun blurEffectFor(radiusPx: Float): RenderEffect? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    return BlurEffects[(radiusPx * 2f).roundToInt().coerceIn(0, BlurEffects.lastIndex)]
}

/** CSS blur() 的参数是高斯标准差，Android 的 blur 参数是半径，按 Skia 的换算公式转换 */
private fun cssBlurToRadius(sigmaPx: Float): Float = ((sigmaPx - 0.5f) / 0.57735f).coerceAtLeast(0f)

private fun lerp(start: Float, stop: Float, fraction: Float) = start + (stop - start) * fraction

@Composable
fun AppleLyrics(
    lines: List<LyricLineData>,
    offsetMs: Long,
    paused: Boolean,
    style: LyricsStyle,
    onLinePress: (Int) -> Unit,
    onBackgroundPress: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val currentOffset by rememberUpdatedState(offsetMs)
    val currentOnLinePress by rememberUpdatedState(onLinePress)
    val currentOnBackgroundPress by rememberUpdatedState(onBackgroundPress)
    val timeMs = remember { mutableLongStateOf(0L) }
    val textMeasurer = rememberTextMeasurer()

    val prepared = remember(lines) { prepareLines(lines) }
    // 动画状态只跟时间轴绑定：切换翻译 / 罗马音只改变行高，不应重建状态导致整页重新飞入
    val timingKey = remember(lines) { lines.map { it.startMs to it.endMs } }
    val timeline = remember(timingKey) { LyricsTimeline(prepared) }
    val state = remember(timingKey) { LyricsLayoutState(prepared, scope) }

    // 页面不可见时停止逐帧驱动，避免一直请求帧
    LaunchedEffect(paused, state) {
        if (paused) return@LaunchedEffect
        val clock = PlaybackClock()
        while (true) {
            withFrameNanos { frameNanos ->
                val time = clock.sample(frameNanos) - currentOffset
                timeMs.longValue = time
                state.onFrame(timeline.snapshotAt(time), clock.isPlaying, clock.consumeSeek(), time)
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val density = LocalDensity.current
        val fontPx = if (style.fontSize > 0f) {
            with(density) { style.fontSize.sp.toPx() }
        } else {
            max(constraints.maxWidth * 0.08f, with(density) { 12.sp.toPx() })
        }
        val metrics = remember(fontPx, density) { LyricsMetrics(fontPx, density) }
        val fadeTopPx = with(density) { style.fadeTop.dp.toPx() }
        val fadeBottomPx = with(density) { style.fadeBottom.dp.toPx() }
        val bottomInsetPx = with(density) { style.bottomInset.dp.toPx() }

        Layout(
            modifier = Modifier
                .fillMaxSize()
                .clipToBounds()
                .edgeFade(fadeTopPx, fadeBottomPx, bottomInsetPx)
                .pointerInput(state) {
                    val tracker = VelocityTracker()
                    detectVerticalDragGestures(
                        onDragStart = {
                            tracker.resetTracking()
                            state.startDrag()
                        },
                        onDragEnd = { state.endDrag(tracker.calculateVelocity().y) },
                        onDragCancel = { state.endDrag(0f) },
                        onVerticalDrag = { change, dragAmount ->
                            tracker.addPosition(change.uptimeMillis, change.position)
                            change.consume()
                            state.dragBy(dragAmount)
                        },
                    )
                }
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { currentOnBackgroundPress() })
                },
            content = {
                prepared.forEachIndexed { index, line ->
                    LyricLineItem(
                        line = line,
                        index = index,
                        state = state,
                        timeMs = timeMs,
                        style = style,
                        metrics = metrics,
                        textMeasurer = textMeasurer,
                        onClick = {
                            state.resumeNow()
                            currentOnLinePress(index)
                        },
                    )
                }
                InterludeDots(state, timeMs, style.color, metrics)
            },
        ) { measurables, constraints ->
            val width = constraints.maxWidth
            val height = constraints.maxHeight
            val placeables = measurables.map { it.measure(Constraints(maxWidth = width)) }
            val viewport = (height - bottomInsetPx).coerceAtLeast(0f)
            state.onMeasured(
                heights = IntArray(prepared.size) { placeables[it].height },
                dotsHeight = placeables.last().height,
                viewport = viewport,
                widthPx = width.toFloat(),
                metrics = metrics,
            )

            val overscan = OVERSCAN_DP * metrics.density + viewport * MOTION_BUFFER_RATIO
            layout(width, height) {
                for (i in prepared.indices) {
                    val placeable = placeables[i]
                    placeable.placeWithLayer(0, 0) {
                        val y = state.ys[i].value + state.userScroll.value
                        val inView = y < viewport + overscan && y + placeable.height > -overscan
                        translationY = y
                        // 首次排版完成前各行都还堆在原点，先不显示
                        if (!state.isBuilt) {
                            alpha = 0f
                            return@placeWithLayer
                        }
                        val scale = state.scales[i].value
                        scaleX = scale
                        scaleY = scale
                        transformOrigin = TransformOrigin(0f, 0.5f)
                        val inactiveAlpha = if (prepared[i].isDynamic) 1f else NON_DYNAMIC_INACTIVE_GROUP_ALPHA
                        // 视口外不绘制，也不做模糊
                        alpha = if (inView) lerp(inactiveAlpha, ACTIVE_GROUP_ALPHA, state.actives[i].value) else 0f
                        renderEffect = if (inView) blurEffectFor(state.blurs[i].value) else null
                    }
                }
                placeables.last().placeWithLayer(0, 0) {
                    translationY = state.dotsY.value + state.userScroll.value
                    alpha = if (state.isBuilt) 1f else 0f
                }
            }
        }
    }
}

/** 随字号变化的尺寸，单位均为像素 */
@Immutable
private class LyricsMetrics(val fontPx: Float, density: Density) {
    val density: Float = density.density
    val textStyle = TextStyle(
        fontSize = with(density) { fontPx.toSp() },
        fontWeight = FontWeight.Bold,
        lineHeight = with(density) { (fontPx * 1.2f).toSp() },
    )
    val subTextStyle = TextStyle(
        fontSize = with(density) { (fontPx * 0.5f).toSp() },
        fontWeight = FontWeight.Medium,
        lineHeight = with(density) { (fontPx * 0.75f).toSp() },
    )
    val linePaddingVertical = fontPx * 0.4f
    val subLineGap = fontPx * 0.3f
    val cornerRadius = fontPx * 0.25f
    val dotMargin = fontPx * 0.4f
}

@Composable
private fun LyricLineItem(
    line: PreparedLine,
    index: Int,
    state: LyricsLayoutState,
    timeMs: LongState,
    style: LyricsStyle,
    metrics: LyricsMetrics,
    textMeasurer: TextMeasurer,
    onClick: () -> Unit,
) {
    val density = LocalDensity.current
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(with(density) { metrics.cornerRadius.toDp() }))
            .background(if (pressed) style.color.copy(alpha = HOVER_ALPHA) else Color.Transparent)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(
                horizontal = LinePadding,
                vertical = with(density) { metrics.linePaddingVertical.toDp() },
            ),
    ) {
        KaraokeText(line, index, state, timeMs, style, metrics, textMeasurer)

        line.data.subText?.let { subText ->
            BasicText(
                text = subText,
                modifier = Modifier.padding(top = with(density) { metrics.subLineGap.toDp() }),
                style = metrics.subTextStyle,
                color = { style.color.copy(alpha = style.color.alpha * SUB_LINE_ALPHA) },
            )
        }
    }
}

/** 单词在某一行上的片段：跨行的单词按主排版的实际换行拆开 */
private class WordSegment(
    val charStart: Int,
    /** 片段在主排版中的左边界 */
    val left: Float,
    val layout: TextLayoutResult,
    /** 片段在整个单词宽度中的起点，用来让渐变跨行连续扫过 */
    val offsetInWord: Float,
)

private class WordGlyphs(
    val segments: List<WordSegment>,
    val width: Float,
    /** 强调词逐字拆开排版：每个字符在主文本中的偏移和对应排版 */
    val chars: List<Pair<Int, TextLayoutResult>>,
)

private class KaraokeLayouts {
    var main: TextLayoutResult? = null
    var words: List<WordGlyphs> = emptyList()
    var wordsStyle: TextStyle? = null
    var wordsWidth = -1
}

@Composable
private fun KaraokeText(
    line: PreparedLine,
    index: Int,
    state: LyricsLayoutState,
    timeMs: LongState,
    style: LyricsStyle,
    metrics: LyricsMetrics,
    textMeasurer: TextMeasurer,
) {
    val layouts = remember(line) { KaraokeLayouts() }

    Layout(
        content = {},
        modifier = Modifier.drawBehind {
            val main = layouts.main ?: return@drawBehind
            drawLyricText(line, main, layouts.words, state.actives[index].value, timeMs, style.color, metrics)
        },
    ) { _, constraints ->
        val main = textMeasurer.measure(
            text = line.data.text,
            style = metrics.textStyle,
            constraints = Constraints(maxWidth = constraints.maxWidth),
        )
        layouts.main = main
        // 单词单独排版，绘制时按主排版的位置摆放，方便逐词上浮、逐字强调；换行随宽度变化，所以宽度变了要重排
        if (line.isDynamic && (layouts.wordsStyle != metrics.textStyle || layouts.wordsWidth != constraints.maxWidth)) {
            layouts.words = line.spans.map { span -> measureWord(span, main, textMeasurer, metrics.textStyle) }
            layouts.wordsStyle = metrics.textStyle
            layouts.wordsWidth = constraints.maxWidth
        }
        layout(main.size.width, main.size.height) {}
    }
}

private fun measureWord(
    span: PreparedSpan,
    main: TextLayoutResult,
    textMeasurer: TextMeasurer,
    textStyle: TextStyle,
): WordGlyphs {
    val text = span.data.text
    val spanStart = span.data.charStart
    val spanEnd = span.data.charEnd

    val segments = mutableListOf<WordSegment>()
    var width = 0f
    var start = spanStart
    while (start < spanEnd) {
        val lineEnd = main.getLineEnd(main.getLineForOffset(start))
        val end = if (lineEnd in (start + 1)..spanEnd) lineEnd else spanEnd
        val layout = textMeasurer.measure(text.substring(start - spanStart, end - spanStart), textStyle, softWrap = false, maxLines = 1)
        segments.add(WordSegment(start, main.rangeLeft(start, end), layout, width))
        width += layout.size.width
        start = end
    }

    val chars = if (span.emphasis == null) {
        emptyList()
    } else {
        buildList {
            var offset = 0
            while (offset < text.length) {
                val next = text.offsetByCodePoints(offset, 1)
                val char = text.substring(offset, next)
                if (char.isNotBlank()) {
                    add(spanStart + offset to textMeasurer.measure(char, textStyle, softWrap = false, maxLines = 1))
                }
                offset = next
            }
        }
    }
    return WordGlyphs(segments, width, chars)
}

private fun DrawScope.drawLyricText(
    line: PreparedLine,
    main: TextLayoutResult,
    words: List<WordGlyphs>,
    progress: Float,
    timeMs: LongState,
    color: Color,
    metrics: LyricsMetrics,
) {
    // 非逐字歌词整行实色，明暗由整组透明度决定
    if (!line.isDynamic || words.size != line.spans.size) {
        drawText(main, color = color)
        return
    }

    // 非高亮行不读取播放时间，这样只有高亮行会逐帧重绘
    if (progress <= 0f) {
        drawText(main, color = color.copy(alpha = color.alpha * DIM_ALPHA))
        return
    }

    val now = timeMs.longValue
    val bright = color.copy(alpha = color.alpha * lerp(DIM_ALPHA, 1f, progress))
    val dark = color.copy(alpha = color.alpha * lerp(DIM_ALPHA, UNSUNG_ALPHA, progress))
    val em = metrics.fontPx

    line.spans.forEachIndexed { i, span ->
        val word = words[i]
        val first = word.segments.firstOrNull() ?: return@forEachIndexed
        val width = word.width
        val fade = first.layout.size.height * WORD_FADE_WIDTH
        val duration = (span.data.endMs - span.data.startMs).coerceAtLeast(1L).toFloat()
        val elapsed = (now - span.data.startMs).toFloat()

        // 渐变中心从词首匀速扫到词尾，两端各留出半个过渡宽度；跨行的词按片段宽度依次扫过
        val center = (elapsed / duration * width).coerceIn(-fade / 2f, width + fade / 2f)
        fun brushAt(positionInWord: Float) = Brush.horizontalGradient(
            0f to bright,
            1f to dark,
            startX = center - fade / 2f - positionInWord,
            endX = center + fade / 2f - positionInWord,
        )

        val emphasis = span.emphasis
        if (emphasis == null) {
            val floatT = clamp01(elapsed / max(WORD_FLOAT_MIN_DURATION_MS, duration))
            val lift = -CssEaseOut.transform(floatT) * WORD_FLOAT_EM * em * progress
            for (segment in word.segments) {
                val x = segment.left
                val y = main.getLineBaseline(main.getLineForOffset(segment.charStart)) - segment.layout.firstBaseline
                translate(left = x, top = y + lift) {
                    drawText(segment.layout, brush = brushAt(segment.offsetInWord))
                }
            }
            return@forEachIndexed
        }

        // 长音强调：逐字依次放大、发光并互相推开，最后一个词效果更强
        val count = word.chars.size
        word.chars.forEachIndexed { k, (charOffset, glyph) ->
            val charX = main.getBoundingBox(charOffset).left
            val charY = main.getLineBaseline(main.getLineForOffset(charOffset)) - glyph.firstBaseline
            val segment = word.segments.last { it.charStart <= charOffset }
            val positionInWord = segment.offsetInWord +
                charX - segment.left
            val charElapsed = elapsed - emphasis.durationMs / 2.5f / count * k
            val glowT = clamp01(charElapsed / emphasis.durationMs)
            val trans = emphasisEasing(glowT) * progress
            val floatT = clamp01(charElapsed / (emphasis.durationMs * 1.4f))
            val floatY = -(sin(floatT * PI).toFloat() * 0.05f + floatT * 0.05f) * em * progress
            val scale = 1f + trans * 0.1f * emphasis.amount
            val offsetX = -trans * 0.03f * emphasis.amount * (count / 2f - k) * em
            val offsetY = -trans * 0.025f * emphasis.amount * em
            val glow = trans * emphasis.blur
            val shadow = if (glow > 0.01f) {
                Shadow(color = color.copy(alpha = glow.coerceAtMost(1f)), blurRadius = min(0.3f, emphasis.blur * 0.3f) * em)
            } else {
                null
            }
            translate(left = charX + offsetX, top = charY + offsetY + floatY) {
                scale(scale, pivot = Offset(glyph.size.width / 2f, glyph.size.height / 2f)) {
                    drawText(glyph, brush = brushAt(positionInWord), shadow = shadow)
                }
            }
        }
    }
}

/**
 * 一段文字在主排版中的左边界。RTL 及双向混排时起始字符不一定在最左侧，
 * 所以取片段内所有字符包围盒的最小值
 */
private fun TextLayoutResult.rangeLeft(start: Int, end: Int): Float {
    val text = layoutInput.text.text
    var left = Float.MAX_VALUE
    var offset = start
    while (offset < end) {
        left = min(left, getBoundingBox(offset).left)
        offset = text.offsetByCodePoints(offset, 1)
    }
    return left
}

/** 强调动画的先升后降曲线 */
private fun emphasisEasing(x: Float): Float =
    if (x < 0.5f) EmphasisInEasing.transform(x / 0.5f) else 1f - EmphasisOutEasing.transform((x - 0.5f) / 0.5f)

@Composable
private fun InterludeDots(state: LyricsLayoutState, timeMs: LongState, color: Color, metrics: LyricsMetrics) {
    val density = LocalDensity.current
    val frame = remember { InterludeDotsFrame() }
    val dotSize = metrics.fontPx * 0.3f
    val gap = metrics.fontPx * 0.18f
    val contentHeight = metrics.fontPx * 0.5f
    val paddingVertical = metrics.fontPx * 0.4f
    val paddingHorizontal = with(density) { LinePadding.toPx() }
    val widthPx = paddingHorizontal * 2 + dotSize * 3 + gap * 2
    val heightPx = contentHeight + paddingVertical * 2

    Canvas(Modifier.size(with(density) { widthPx.toDp() }, with(density) { heightPx.toDp() })) {
        val dots = state.dots ?: return@Canvas
        dots.resolve(timeMs.longValue, frame)
        if (frame.opacity <= 0f) return@Canvas
        scale(frame.scale, pivot = center) {
            for (i in 0 until InterludeDotsTimeline.DOT_COUNT) {
                drawCircle(
                    color = color,
                    radius = dotSize / 2f,
                    center = Offset(paddingHorizontal + dotSize / 2f + i * (dotSize + gap), size.height / 2f),
                    alpha = (frame.opacity * frame.dotOpacities[i]).coerceIn(0f, 1f),
                )
            }
        }
    }
}

private fun Modifier.edgeFade(fadeTop: Float, fadeBottom: Float, bottomInset: Float): Modifier = this
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        val h = size.height
        if (h <= 0f) return@drawWithContent
        val visibleBottom = (h - bottomInset).coerceIn(0f, h)
        val topStop = (fadeTop / h).coerceIn(0f, visibleBottom / h)
        val bottomEnd = visibleBottom / h
        val bottomStart = ((visibleBottom - fadeBottom) / h).coerceIn(topStop, bottomEnd)
        drawRect(
            brush = Brush.verticalGradient(
                0f to Color.Transparent,
                topStop to Color.Black,
                bottomStart to Color.Black,
                bottomEnd to Color.Transparent,
                1f to Color.Transparent,
            ),
            blendMode = BlendMode.DstIn,
        )
    }

/** 触发排版的原因，决定是否错峰以及首次进入时的飞入动画，对应 AMLL 的 LayoutReason */
private enum class LayoutReason(val disableStagger: Boolean) {
    PlaybackTick(false),
    Seek(true),
    Rebuild(true),
    Resize(true),
    Config(true),
    InteractionStart(true),
}

private sealed interface Focus {
    data class Line(val index: Int) : Focus
    data class Interlude(val anchorIndex: Int) : Focus
}

/**
 * 每行歌词各自持有位置、缩放、模糊、高亮四个动画值，排版只在时间线状态变化时进行一次，
 * 绘制和图层属性直接读取动画值，所以换行之外的时间里不会触发重组。
 */
private class LyricsLayoutState(
    private val lines: List<PreparedLine>,
    private val scope: CoroutineScope,
) {
    private val count = lines.size
    val ys = Array(count) { Animatable(0f, visibilityThreshold = POSITION_VISIBILITY_THRESHOLD) }
    val scales = Array(count) { Animatable(1f, visibilityThreshold = SCALE_VISIBILITY_THRESHOLD) }
    val blurs = Array(count) { Animatable(0f) }
    val actives = Array(count) { Animatable(0f) }
    val dotsY = Animatable(0f)
    val userScroll = Animatable(0f)

    /** 是否已完成首次排版，之前各行都在原点，不能显示 */
    var isBuilt by mutableStateOf(false)
        private set

    /** 当前间奏的演出时间轴，绘制间奏点时读取 */
    var dots by mutableStateOf<InterludeDotsTimeline?>(null)
        private set

    private val heights = IntArray(count)
    private var dotsHeight = 0
    private var viewport = 0f
    private var widthPx = 0f
    private var metrics: LyricsMetrics? = null

    private var snapshot: TimelineSnapshot? = null
    private var isPlaying = false
    private var currentInterlude: Interlude? = null
    private var focus: Focus = Focus.Line(0)

    private var autoAlignSuspended = false
    private var touchScrolled = false
    private var isDragging = false
    private var scrollEndAt = 0L
    private var flingJob: Job? = null

    private val posJobs = arrayOfNulls<Job>(count)
    private val scaleJobs = arrayOfNulls<Job>(count)
    private val posTargets = FloatArray(count) { Float.NaN }
    private val scaleTargets = FloatArray(count) { 1f }
    private val blurTargets = FloatArray(count)
    private val activeTargets = FloatArray(count)
    private var dotsJob: Job? = null
    private var dotsAnchorIndex = Int.MIN_VALUE

    // 最近一次排版的结果，用于计算手动滚动边界
    private var lastBase = 0f
    private var lastFocalTop = 0f
    private var lastTotalHeight = 0f

    fun onMeasured(heights: IntArray, dotsHeight: Int, viewport: Float, widthPx: Float, metrics: LyricsMetrics) {
        val changed = !heights.contentEquals(this.heights) ||
            dotsHeight != this.dotsHeight ||
            viewport != this.viewport ||
            widthPx != this.widthPx ||
            metrics !== this.metrics
        if (!changed) return
        heights.copyInto(this.heights)
        this.dotsHeight = dotsHeight
        this.viewport = viewport
        this.widthPx = widthPx
        this.metrics = metrics
        // 在测量阶段同步排版并直接定位，本帧放置时就能拿到新位置，不会闪一帧旧位置
        relayout(if (isBuilt) LayoutReason.Resize else LayoutReason.Rebuild)
    }

    fun onFrame(next: TimelineSnapshot, playing: Boolean, seeked: Boolean, timeMs: Long) {
        val interlude = next.interlude
        if (interlude !== currentInterlude || (seeked && interlude != null)) {
            currentInterlude = interlude
            dots = interlude?.let {
                // 跳转进入间奏时从当前时间重新开始演出
                val anchorMs = if (seeked) timeMs else it.startMs
                val delayMs = if (!seeked && it.anchorIndex == -1) 0L else InterludeDotsTimeline.ENTER_HOLD_MS
                InterludeDotsTimeline(it.startMs, it.endMs, anchorMs, delayMs)
            }
        }

        val previous = snapshot
        val playingChanged = playing != isPlaying
        snapshot = next
        isPlaying = playing

        when {
            seeked -> {
                // 手指滑动挂起期间跳转不打断，等下一次换行再恢复
                if (!touchScrolled) resumeAutoAlign()
                relayout(if (isBuilt) LayoutReason.Seek else LayoutReason.Rebuild)
            }
            previous == null -> relayout(LayoutReason.Rebuild)
            previous != next -> {
                val focusChanged = previous.scrollToIndex != next.scrollToIndex ||
                    (previous.interlude == null) != (next.interlude == null)
                if (focusChanged && autoAlignSuspended && !isDragging && flingJob?.isActive != true &&
                    SystemClock.uptimeMillis() - scrollEndAt >= AUTO_ALIGN_RESUME_DELAY_MS
                ) {
                    resumeAutoAlign()
                }
                relayout(LayoutReason.PlaybackTick)
            }
            playingChanged -> relayout(LayoutReason.Config)
        }
    }

    private fun relayout(reason: LayoutReason) {
        val snap = snapshot ?: return
        val metrics = metrics ?: return
        if (count == 0 || viewport <= 0f) return

        val interlude = snap.interlude
        val canShowDots = interlude != null && dots?.canDisplay == true

        focus = if (autoAlignSuspended) {
            // 挂起期间维持原焦点；离开间奏时顺延到间奏后的下一行
            (focus as? Focus.Interlude)
                ?.takeUnless { canShowDots }
                ?.let { Focus.Line((it.anchorIndex + 1).coerceIn(0, count - 1)) }
                ?: focus
        } else {
            when {
                interlude != null && canShowDots -> Focus.Interlude(interlude.anchorIndex)
                interlude != null -> Focus.Line((interlude.anchorIndex + 1).coerceIn(0, count - 1))
                else -> Focus.Line(snap.scrollToIndex.coerceIn(0, count - 1))
            }
        }

        val interludeAnchor = when {
            canShowDots -> interlude!!.anchorIndex
            focus is Focus.Interlude -> (focus as Focus.Interlude).anchorIndex
            else -> null
        }
        val dotsTotal = dotsHeight + metrics.dotMargin * 2

        val prefix = FloatArray(count + 1)
        for (i in 0 until count) prefix[i + 1] = prefix[i] + heights[i]
        fun lineTop(i: Int) = prefix[i] + if (interludeAnchor != null && i > interludeAnchor) dotsTotal else 0f

        val (focalTop, focalHeight) = when (val f = focus) {
            is Focus.Line -> lineTop(f.index) to heights[f.index].toFloat()
            is Focus.Interlude -> prefix[f.anchorIndex + 1] to dotsTotal
        }
        val base = viewport * ALIGN_POSITION - focalHeight / 2f - focalTop
        lastBase = base
        lastFocalTop = focalTop
        lastTotalHeight = prefix[count] + if (interludeAnchor != null) dotsTotal else 0f

        val scrollTo = snap.scrollToIndex.coerceIn(0, count - 1)
        val latest = snap.latestIndex.coerceIn(0, count - 1)
        val intervalMs = if (scrollTo > 0) lines[scrollTo].startMs - lines[scrollTo - 1].startMs else null
        val posSpec = if (reason == LayoutReason.Seek || reason == LayoutReason.Rebuild || interlude != null) {
            SlowPositionSpring
        } else {
            positionSpring(intervalMs)
        }

        val overscan = OVERSCAN_DP * metrics.density + viewport * MOTION_BUFFER_RATIO
        val isNarrow = widthPx / metrics.density <= NARROW_VIEWPORT_DP

        var delayMs = 0.0
        var step = if (reason.disableStagger) 0.0 else STAGGER_STEP_MS

        for (i in 0 until count) {
            val target = base + lineTop(i)
            val height = heights[i]
            val isActive = i in snap.highlighted || (i >= scrollTo && i < latest)
            val inViewport = target <= viewport + overscan && target + height >= -overscan

            // 手动滚动挂起期间焦点已冻结，目标位置只会因行高变化或间奏插入而改变，照常更新不会触发自动滚动
            animatePosition(i, target, delayMs.toLong(), posSpec, reason)
            animateScale(i, if (!isActive && isPlaying) INACTIVE_SCALE else 1f, delayMs.toLong())
            animateBlur(i, blurRadiusFor(i, isActive, inViewport, scrollTo, latest, isNarrow, metrics))
            animateActive(i, if (isActive) 1f else 0f)

            // 阶梯式延迟只在可见行之间累加，焦点之后逐行递减
            if (target + height >= 0f) {
                delayMs += step
                if (i >= scrollTo) step /= 1.05
            }
        }

        if (interludeAnchor != null) {
            val target = base + prefix[interludeAnchor + 1] + metrics.dotMargin
            // 新出现的间奏直接定位，避免从上一个间奏的位置飞过来
            val isNewInterlude = interludeAnchor != dotsAnchorIndex
            dotsAnchorIndex = interludeAnchor
            dotsJob?.cancel()
            dotsJob = scope.launch(start = CoroutineStart.UNDISPATCHED) {
                if (reason == LayoutReason.PlaybackTick && !isNewInterlude) dotsY.animateTo(target, posSpec) else dotsY.snapTo(target)
            }
        }

        if (reason == LayoutReason.Rebuild) isBuilt = true
    }

    private fun blurRadiusFor(
        i: Int,
        isActive: Boolean,
        inViewport: Boolean,
        scrollTo: Int,
        latest: Int,
        isNarrow: Boolean,
        metrics: LyricsMetrics,
    ): Float {
        // 触摸滑动期间、焦点行和视口外都不模糊
        if (touchScrolled || isActive || !inViewport) return 0f
        val distance = if (i < scrollTo) scrollTo - i + 1 else abs(i - latest)
        var level = 1f + distance
        if (isNarrow) level *= NARROW_BLUR_FACTOR
        return cssBlurToRadius(min(MAX_BLUR_DP, level) * metrics.density)
    }

    private fun animatePosition(i: Int, target: Float, delayMs: Long, spec: AnimationSpec<Float>, reason: LayoutReason) {
        if (posTargets[i] == target && reason != LayoutReason.Rebuild) return
        posTargets[i] = target
        posJobs[i]?.cancel()
        val anim = ys[i]

        if (reason == LayoutReason.Rebuild) {
            // 首次载入时从视口下方飞入
            posJobs[i] = scope.launch(start = CoroutineStart.UNDISPATCHED) {
                anim.snapTo(target + viewport)
                anim.animateTo(target, spec)
            }
            return
        }

        // 尺寸变化（含切换翻译导致的行高变化）直接定位，避免各行在弹簧过程中互相重叠
        val isFar = { y: Float -> y + heights[i] < -viewport || y > viewport * 2 }
        if (reason == LayoutReason.Resize || (isFar(anim.value) && isFar(target))) {
            posJobs[i] = scope.launch(start = CoroutineStart.UNDISPATCHED) { anim.snapTo(target) }
            return
        }

        posJobs[i] = scope.launch {
            if (delayMs > 0) delay(delayMs)
            anim.animateTo(target, spec)
        }
    }

    private fun animateScale(i: Int, target: Float, delayMs: Long) {
        if (scaleTargets[i] == target) return
        scaleTargets[i] = target
        scaleJobs[i]?.cancel()
        scaleJobs[i] = scope.launch {
            if (delayMs > 0) delay(delayMs)
            scales[i].animateTo(target, ScaleSpring)
        }
    }

    private fun animateBlur(i: Int, target: Float) {
        if (blurTargets[i] == target) return
        blurTargets[i] = target
        scope.launch { blurs[i].animateTo(target, tween(BLUR_TRANSITION_MS, easing = CssEase)) }
    }

    private fun animateActive(i: Int, target: Float) {
        if (activeTargets[i] == target) return
        activeTargets[i] = target
        val duration = if (target > 0f) ACTIVATE_MS else DEACTIVATE_MS
        scope.launch { actives[i].animateTo(target, tween(duration, easing = CssEaseOut)) }
    }

    fun startDrag() {
        isDragging = true
        flingJob?.cancel()
        autoAlignSuspended = true
        touchScrolled = true
        // 内容最多下拉到首行对齐焦点位置，最多上推到末尾停在视口中线
        val upper = max(0f, lastFocalTop)
        val lower = -max(0f, lastBase + lastTotalHeight - viewport / 2f)
        userScroll.updateBounds(lowerBound = lower, upperBound = upper)
        relayout(LayoutReason.InteractionStart)
    }

    fun dragBy(delta: Float) {
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            userScroll.snapTo(userScroll.value + delta)
        }
    }

    fun endDrag(velocity: Float) {
        isDragging = false
        scrollEndAt = SystemClock.uptimeMillis()
        flingJob = scope.launch {
            userScroll.animateDecay(velocity, ScrollDecay)
            scrollEndAt = SystemClock.uptimeMillis()
        }
    }

    /** 点击歌词行时立即恢复自动对齐 */
    fun resumeNow() {
        if (!autoAlignSuspended) return
        resumeAutoAlign()
        relayout(LayoutReason.PlaybackTick)
    }

    private fun resumeAutoAlign() {
        if (!autoAlignSuspended) return
        flingJob?.cancel()
        autoAlignSuspended = false
        touchScrolled = false
        val offset = userScroll.value
        posJobs.forEach { it?.cancel() }
        dotsJob?.cancel()
        posTargets.fill(Float.NaN)
        // 把手动滚动的偏移折算回各行，再从当前位置弹回
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            ys.forEach { it.snapTo(it.value + offset) }
            dotsY.snapTo(dotsY.value + offset)
            userScroll.snapTo(0f)
        }
    }
}
