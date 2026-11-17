package expo.modules.orpheus.telemetry

import android.os.Handler
import android.os.Looper
import io.sentry.ISpan
import io.sentry.ITransaction
import io.sentry.Sentry
import io.sentry.SpanStatus
import io.sentry.TransactionContext
import io.sentry.TransactionOptions

/**
 * 记录 playback.wait_for_audio transaction：用户想播（playWhenReady），但还没出声（!isPlaying）的这段时间。
 *
 * 切歌和按下播放时检查一次这个条件，成立就开始，出声时结束。预加载好的下一首、
 * 缓冲还在的继续播放都会立即出声，条件不成立，也就不会记录。
 * 不论起播由谁触发（JS、通知栏、耳机、自动下一首）都会经过这里。播放中途的卡顿缓冲不算。
 *
 * 播放器回调在主线程，取流在加载线程，所以所有入口都加锁。
 */
object PlaybackTracer {
    private const val TIMEOUT_MS = 30_000L

    private class Active(val transaction: ITransaction, val uri: String?)

    private val handler = Handler(Looper.getMainLooper())
    private var active: Active? = null

    private val timeoutRunnable = Runnable {
        synchronized(PlaybackTracer) { finish(SpanStatus.DEADLINE_EXCEEDED, "playback.timed_out") }
    }

    /** 切到一首新歌时调用（同一首歌因队列变动、单曲循环触发的 transition 不算） */
    @Synchronized
    fun onMediaItemTransition(
        mediaId: String?,
        uri: String?,
        reason: String,
        playWhenReady: Boolean,
        isPlaying: Boolean,
    ) {
        finish(SpanStatus.CANCELLED, "playback.cancelled")
        if (mediaId != null && playWhenReady && !isPlaying) start(mediaId, uri, reason)
    }

    @Synchronized
    fun onPlayWhenReadyChanged(playWhenReady: Boolean, isPlaying: Boolean, mediaId: String?, uri: String?) {
        if (!playWhenReady) {
            finish(SpanStatus.CANCELLED, "playback.cancelled")
        } else if (active == null && mediaId != null && !isPlaying) {
            start(mediaId, uri, "PLAY")
        }
    }

    @Synchronized
    fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) finish(SpanStatus.OK)
    }

    @Synchronized
    fun onPlayerError(errorCodeName: String, error: Throwable) {
        val current = active ?: return
        current.transaction.setData("error.type", errorCodeName)
        current.transaction.throwable = error
        finish(SpanStatus.INTERNAL_ERROR)
    }

    @Synchronized
    fun onServiceDestroyed() {
        finish(SpanStatus.CANCELLED, "playback.cancelled")
    }

    /**
     * 正在等待 [uri] 出声时返回它的 span，取流请求挂到它下面；否则返回 null（预加载下一首、下载等）。
     * 同时记下这次确实请求了地址，没有命中缓存。
     */
    @Synchronized
    fun spanForResolve(uri: String): ISpan? {
        val current = active?.takeIf { it.uri == uri } ?: return null
        current.transaction.setData("playback.resolved_url", true)
        return current.transaction
    }

    private fun start(mediaId: String, uri: String?, reason: String) {
        val transaction = Sentry.startTransaction(
            TransactionContext("playback.wait_for_audio", "playback"),
            TransactionOptions().apply { isBindToScope = false },
        )
        transaction.setData("track.id", mediaId)
        transaction.setData("playback.reason", reason)
        transaction.setData("bbplayer.source", "native")

        active = Active(transaction, uri)
        handler.postDelayed(timeoutRunnable, TIMEOUT_MS)
    }

    private fun finish(status: SpanStatus, flag: String? = null) {
        val current = active ?: return
        active = null
        handler.removeCallbacks(timeoutRunnable)
        flag?.let { current.transaction.setData(it, true) }
        current.transaction.finish(status)
    }
}
