package expo.modules.orpheus.util

import kotlin.math.max
import kotlin.math.min

/** 只累计连续播放的媒体时间。跳转必须先结算旧位置，再重置采样基线。 */
class PlaybackHistoryTracker {
    data class Summary(val startedAt: Long, val playedSeconds: Double, val completed: Boolean)

    var trackId: String? = null
        private set
    private var startedAt = 0L
    private var lastPosition = 0.0
    private var wasPlaying = false
    private var playedSeconds = 0.0
    private var roundSeconds = 0.0
    private var completed = false
    private var hadAbLoop = false
    private var range: Pair<Double, Double>? = null

    fun begin(id: String, position: Double, now: Long = System.currentTimeMillis()) {
        trackId = id
        startedAt = now
        lastPosition = position.takeIf { it.isFinite() } ?: 0.0
        wasPlaying = false
        playedSeconds = 0.0
        roundSeconds = 0.0
        completed = false
        hadAbLoop = false
        range = null
    }

    fun sample(position: Double, isPlaying: Boolean, duration: Double) {
        if (trackId == null || !position.isFinite()) return
        val start = range?.first ?: 0.0
        val end = range?.second ?: duration
        if (wasPlaying && position >= lastPosition) {
            val knownEnd = end.isFinite() && end > start
            val delta = if (knownEnd) max(0.0, min(position, end) - max(lastPosition, start))
                else max(0.0, position - lastPosition)
            playedSeconds += delta
            roundSeconds += delta
            if (knownEnd) {
                val length = end - start
                if (roundSeconds + 1e-6 >= max(length * 0.9, length - 2.0)) completed = true
            }
        }
        lastPosition = position
        wasPlaying = isPlaying
    }

    fun setLoop(start: Double?, end: Double?) {
        val next = if (start != null && end != null) Pair(start, end) else null
        if (next == range) return
        range = next
        roundSeconds = 0.0
        if (next != null) hadAbLoop = true
    }

    fun jump(oldPosition: Double, newPosition: Double, isPlaying: Boolean, duration: Double) {
        sample(oldPosition, isPlaying, duration)
        roundSeconds = 0.0
        lastPosition = newPosition
        wasPlaying = isPlaying
    }

    fun finish(): Summary? {
        val result = if (trackId != null && hadAbLoop) Summary(startedAt, playedSeconds, completed) else null
        trackId = null
        wasPlaying = false
        return result
    }
}
