package expo.modules.lyricsview

import androidx.compose.runtime.Immutable

@Immutable
data class LyricSpanData(
    val text: String,
    val startMs: Long,
    val endMs: Long,
    val charStart: Int,
    val charEnd: Int,
)

@Immutable
data class LyricLineData(
    val startMs: Long,
    val endMs: Long,
    val text: String,
    val subText: String?,
    val spans: List<LyricSpanData>,
)

/** 长音强调的参数，算法与 AMLL 的 calculateEmphasizeParams 一致 */
internal class Emphasis(val amount: Float, val blur: Float, val durationMs: Float)

internal class PreparedSpan(val data: LyricSpanData, val emphasis: Emphasis?)

internal class PreparedLine(
    val data: LyricLineData,
    /** 修正后的结束时间：没有给出结束时间的行（普通 LRC）用下一行开始时间兜底 */
    val endMs: Long,
    val spans: List<PreparedSpan>,
) {
    val startMs: Long get() = data.startMs
    val isDynamic: Boolean get() = spans.isNotEmpty()
}

internal class Interlude(val startMs: Long, val endMs: Long, val anchorIndex: Int)

/**
 * 某一时刻的歌词状态，规则与 AMLL 的 TimelineController 一致：
 * - 一行开始后会一直亮到下一行开始（唱完不熄灭），重叠的行可以同时高亮
 * - 处于间奏且没有行正在播放时清空高亮
 */
@Immutable
internal data class TimelineSnapshot(
    val scrollToIndex: Int,
    val latestIndex: Int,
    val highlighted: List<Int>,
    val interlude: Interlude?,
)

internal fun prepareLines(lines: List<LyricLineData>): List<PreparedLine> {
    return lines.mapIndexed { index, line ->
        val nextStart = lines.getOrNull(index + 1)?.startMs
        val endMs = when {
            line.endMs > line.startMs -> line.endMs
            nextStart != null && nextStart > line.startMs -> nextStart
            else -> line.startMs + DEFAULT_LINE_DURATION_MS
        }
        val lastWordIndex = line.spans.indexOfLast { it.text.isNotBlank() }
        val spans = line.spans.mapIndexed { spanIndex, span ->
            PreparedSpan(span, emphasisOf(span, isLastWord = spanIndex == lastWordIndex))
        }
        PreparedLine(line, endMs, spans)
    }
}

private fun emphasisOf(span: LyricSpanData, isLastWord: Boolean): Emphasis? {
    val duration = span.endMs - span.startMs
    val word = span.text.trim()
    val shouldEmphasize = if (isCjk(word)) {
        duration >= EMPHASIS_MIN_DURATION_MS
    } else {
        duration >= EMPHASIS_MIN_DURATION_MS && word.length in 2..7
    }
    if (!shouldEmphasize) return null

    var du = maxOf(1000f, duration.toFloat())
    var amount = du / 2000f
    amount = if (amount > 1f) kotlin.math.sqrt(amount) else amount * amount * amount
    var blur = du / 3000f
    blur = if (blur > 1f) kotlin.math.sqrt(blur) else blur * blur * blur
    amount *= 0.6f
    blur *= 0.5f
    // 为了演出效果，给最后一个词应用更强的效果
    if (isLastWord) {
        amount *= 1.6f
        blur *= 1.5f
        du *= 1.2f
    }
    return Emphasis(amount.coerceAtMost(1.2f), blur.coerceAtMost(0.8f), du)
}

private fun isCjk(text: String): Boolean {
    if (text.isEmpty()) return false
    return text.codePoints().anyMatch {
        when (Character.UnicodeScript.of(it)) {
            Character.UnicodeScript.HAN,
            Character.UnicodeScript.HIRAGANA,
            Character.UnicodeScript.KATAKANA,
            Character.UnicodeScript.HANGUL -> true
            else -> false
        }
    }
}

internal class LyricsTimeline(private val lines: List<PreparedLine>) {
    val interludes: List<Interlude> = computeInterludes()

    /** prefixMaxEnd[i] 为第 0 ~ i 行的最晚结束时间，用来判断还需不需要继续往前找重叠的行 */
    private val prefixMaxEnd = LongArray(lines.size).also { arr ->
        var maxEnd = Long.MIN_VALUE
        lines.forEachIndexed { i, line ->
            maxEnd = maxOf(maxEnd, line.endMs)
            arr[i] = maxEnd
        }
    }

    fun snapshotAt(timeMs: Long): TimelineSnapshot {
        val interlude = interludes.firstOrNull { timeMs >= it.startMs && timeMs < it.endMs }

        // 最后一行真正开始过（且时长不为零）的歌词作为锚点
        var anchor = lastStartedIndex(timeMs)
        while (anchor >= 0 && lines[anchor].endMs <= lines[anchor].startMs) anchor--
        if (anchor < 0) {
            return TimelineSnapshot(scrollToIndex = 0, latestIndex = 0, highlighted = emptyList(), interlude = interlude)
        }

        // 锚点开始时还没唱完的行会一直亮到下一行开始
        val anchorStart = lines[anchor].startMs
        val highlighted = ArrayList<Int>(2)
        var isAnyPlaying = false
        var i = anchor
        // 更早的行都已在锚点开始前结束时停止回扫
        while (i >= 0 && prefixMaxEnd[i] > anchorStart) {
            val line = lines[i]
            if (line.endMs > anchorStart) {
                highlighted.add(0, i)
                if (line.startMs <= timeMs && line.endMs > timeMs) isAnyPlaying = true
            }
            i--
        }

        val scrollToIndex = highlighted.firstOrNull() ?: anchor
        // 间奏期间没有行在播放时清空高亮
        if (interlude != null && !isAnyPlaying) highlighted.clear()

        return TimelineSnapshot(
            scrollToIndex = scrollToIndex,
            latestIndex = highlighted.lastOrNull() ?: scrollToIndex,
            highlighted = highlighted,
            interlude = interlude,
        )
    }

    private fun lastStartedIndex(timeMs: Long): Int {
        var lo = 0
        var hi = lines.size - 1
        var ans = -1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (lines[mid].startMs <= timeMs) {
                ans = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return ans
    }

    /** 按前缀最大结束时间扫描区间并集，产出与任何歌词行都不重叠的间奏区间 */
    private fun computeInterludes(): List<Interlude> {
        val result = mutableListOf<Interlude>()
        var maxEnd = 0L
        for (i in -1 until lines.size - 1) {
            if (i >= 0) maxEnd = maxOf(maxEnd, lines[i].endMs)
            val gapEnd = maxOf(maxEnd, lines[i + 1].startMs)
            if (gapEnd - maxEnd >= MIN_INTERLUDE_GAP_MS) {
                result.add(Interlude(maxEnd, gapEnd, i))
            }
        }
        return result
    }

    private companion object {
        const val MIN_INTERLUDE_GAP_MS = 7000L
    }
}

private const val DEFAULT_LINE_DURATION_MS = 5000L
private const val EMPHASIS_MIN_DURATION_MS = 1000L
