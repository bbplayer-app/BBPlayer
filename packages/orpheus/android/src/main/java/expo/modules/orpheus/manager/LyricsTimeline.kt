package expo.modules.orpheus.manager

import expo.modules.orpheus.model.LyricsData
import expo.modules.orpheus.model.LyricsLine

data class LyricSnapshot(
    val lineIndex: Int,
    val line: LyricsLine?,
    val adjustedTimeMs: Long,
    val lineProgressMs: Long,
    val lineDurationMs: Long,
    val delayMs: Int,
)

class LyricsTimeline(private val data: LyricsData) {
    fun snapshotAt(seconds: Double): LyricSnapshot {
        if (data.lyrics.isEmpty()) {
            return emptySnapshot(adjustedTimeMs = 0L)
        }

        val adjustedTime = seconds - data.offset
        val adjustedTimeMs = (adjustedTime * 1000).toLong().coerceAtLeast(0L)
        val index = data.lyrics.indexOfLast { it.timestamp <= adjustedTime }
        if (index < 0) {
            return emptySnapshot(adjustedTimeMs = adjustedTimeMs)
        }

        val line = data.lyrics[index]
        val lineStartMs = (line.timestamp * 1000).toLong().coerceAtLeast(0L)
        val lineEndMs = resolveLineEndMs(index, lineStartMs)
        val nextLineStartMs = data.lyrics.getOrNull(index + 1)
            ?.timestamp
            ?.times(1000)
            ?.toLong()

        return LyricSnapshot(
            lineIndex = index,
            line = line,
            adjustedTimeMs = adjustedTimeMs,
            lineProgressMs = (adjustedTimeMs - lineStartMs).coerceAtLeast(0L),
            lineDurationMs = (lineEndMs - lineStartMs).coerceAtLeast(1L),
            delayMs = nextLineStartMs?.minus(lineStartMs)?.toInt() ?: 0,
        )
    }

    private fun resolveLineEndMs(index: Int, lineStartMs: Long): Long {
        val line = data.lyrics[index]

        line.endTime?.let {
            return (it * 1000).toLong().coerceAtLeast(lineStartMs)
        }

        data.lyrics.getOrNull(index + 1)?.let {
            return (it.timestamp * 1000).toLong().coerceAtLeast(lineStartMs)
        }

        line.spans?.lastOrNull()?.let {
            return it.endTime.coerceAtLeast(lineStartMs)
        }

        return lineStartMs + DEFAULT_LINE_DURATION_MS
    }

    private fun emptySnapshot(adjustedTimeMs: Long): LyricSnapshot {
        return LyricSnapshot(
            lineIndex = NO_LINE_INDEX,
            line = null,
            adjustedTimeMs = adjustedTimeMs,
            lineProgressMs = 0L,
            lineDurationMs = 0L,
            delayMs = 0,
        )
    }

    private companion object {
        const val DEFAULT_LINE_DURATION_MS = 5000L
        const val NO_LINE_INDEX = -1
    }
}
