package expo.modules.lyricsview

import expo.modules.orpheus.service.OrpheusMusicService
import kotlin.math.abs

/**
 * 每帧从 ExoPlayer 读取播放进度，并按帧间隔外推，避免 offload 等场景下进度跳变导致逐字动画抖动。
 * 只能在主线程调用（ExoPlayer 绑定在主线程 Looper 上）。
 */
internal class PlaybackClock {
    private var predictedMs = 0.0
    private var lastFrameNanos = 0L
    private var hasBaseline = false
    private var seeked = false

    var isPlaying = false
        private set

    fun sample(frameNanos: Long): Long {
        val player = OrpheusMusicService.instance?.player ?: return predictedMs.toLong()
        val actualMs = player.currentPosition.toDouble()
        val elapsedMs = if (lastFrameNanos == 0L) 0.0 else (frameNanos - lastFrameNanos) / 1_000_000.0
        lastFrameNanos = frameNanos
        isPlaying = player.isPlaying

        val expectedMs = if (isPlaying) predictedMs + elapsedMs * player.playbackParameters.speed else predictedMs
        val drift = actualMs - expectedMs
        // 偏差超出容忍范围说明发生了跳转（含暂停时拖动进度条和切歌），直接对齐；否则缓慢修正
        if (!hasBaseline || abs(drift) > SEEK_THRESHOLD_MS) {
            if (hasBaseline) seeked = true
            hasBaseline = true
            predictedMs = actualMs
        } else {
            predictedMs = if (isPlaying) expectedMs + drift * DRIFT_CORRECTION else actualMs
        }
        return predictedMs.toLong()
    }

    /** 读取并清除「上一帧之后发生过跳转」的标记 */
    fun consumeSeek(): Boolean {
        val result = seeked
        seeked = false
        return result
    }

    private companion object {
        // 与 AMLL SeekDetector 的抖动容忍度一致
        const val SEEK_THRESHOLD_MS = 150.0
        const val DRIFT_CORRECTION = 0.1
    }
}
