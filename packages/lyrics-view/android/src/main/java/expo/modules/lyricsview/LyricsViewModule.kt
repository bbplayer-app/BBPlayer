package expo.modules.lyricsview

import android.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import kotlin.math.roundToLong

@OptimizedRecord
class LyricSpanRecord : Record {
    @Field
    val text: String = ""

    @Field
    val startTime: Double = 0.0

    @Field
    val endTime: Double = 0.0
}

@OptimizedRecord
class LyricLineRecord : Record {
    @Field
    val startTime: Double = 0.0

    @Field
    val endTime: Double = 0.0

    @Field
    val content: String = ""

    @Field
    val subText: String? = null

    @Field
    val spans: List<LyricSpanRecord> = emptyList()
}

class LyricsViewModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BBPlayerLyricsView")

        View(LyricsView::class) {
            Prop("lines") { view: LyricsView, lines: List<LyricLineRecord> ->
                view.lines = lines.map { it.toLineData() }
            }

            // 单位秒，含义与 JS 侧的 userOffset 一致：显示时间 = 播放进度 - offset
            Prop("offset") { view: LyricsView, offset: Double ->
                view.offsetMs = (offset * 1000).roundToLong()
            }

            Prop("paused") { view: LyricsView, paused: Boolean ->
                view.paused = paused
            }

            Prop("color") { view: LyricsView, color: Color ->
                view.color = androidx.compose.ui.graphics.Color(color.toArgb())
            }

            // "plus" 为 Apple Music 的叠加混合，只适合深色背景
            Prop("blendMode") { view: LyricsView, blendMode: String ->
                view.setBlendPlus(blendMode == "plus")
            }

            Prop("fontSize") { view: LyricsView, fontSize: Float ->
                view.fontSize = fontSize
            }

            Prop("fadeTop") { view: LyricsView, value: Float ->
                view.fadeTop = value
            }

            Prop("fadeBottom") { view: LyricsView, value: Float ->
                view.fadeBottom = value
            }

            Prop("bottomInset") { view: LyricsView, value: Float ->
                view.bottomInset = value
            }

            Events("onLinePress", "onBackgroundPress")
        }
    }
}

private fun LyricLineRecord.toLineData(): LyricLineData {
    if (spans.isEmpty()) {
        return LyricLineData(
            startMs = startTime.toLong(),
            endMs = endTime.toLong(),
            text = content,
            subText = subText?.takeIf { it.isNotBlank() },
            spans = emptyList(),
        )
    }

    // 逐字行的正文直接由 span 拼接，保证字符下标和 span 一一对应
    var cursor = 0
    val spanData = spans.map { span ->
        val start = cursor
        cursor += span.text.length
        LyricSpanData(
            text = span.text,
            startMs = span.startTime.toLong(),
            endMs = span.endTime.toLong(),
            charStart = start,
            charEnd = cursor,
        )
    }

    return LyricLineData(
        startMs = startTime.toLong(),
        endMs = endTime.toLong(),
        text = spans.joinToString("") { it.text },
        subText = subText?.takeIf { it.isNotBlank() },
        spans = spanData,
    )
}
