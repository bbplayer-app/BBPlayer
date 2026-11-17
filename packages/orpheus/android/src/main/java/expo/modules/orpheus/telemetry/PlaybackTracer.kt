package expo.modules.orpheus.telemetry

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import io.sentry.ISpan
import io.sentry.ITransaction
import io.sentry.Sentry
import io.sentry.ScopesAdapter
import io.sentry.SentryLongDate
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

    private class Active(val transaction: ITransaction, val mediaId: String, val uri: String?) {
        var phase: ISpan? = null
        val tasks = mutableSetOf<ISpan>()
        var formatSeen = false
        var outputSeen = false
    }

    private val handler = Handler(Looper.getMainLooper())
    private var active: Active? = null

    private val timeoutRunnable = Runnable {
        synchronized(PlaybackTracer) { finish(SpanStatus.DEADLINE_EXCEEDED, "playback.timed_out") }
    }

    /** 主动播放时在 prepare/seek/addMediaItems 之前调用，加载线程可能先于播放器回调开始取流。 */
    @Synchronized
    fun onPlaybackRequested(mediaId: String, uri: String?, reason: String) {
        if (active?.let { it.mediaId == mediaId && it.uri == uri } == true) return
        finish(SpanStatus.CANCELLED, "playback.cancelled")
        start(mediaId, uri, reason)
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
        // 主动播放命令已提前创建 transaction；不能在相同曲目的回调中把它结束后重建。
        if (active?.let { it.mediaId == mediaId && it.uri == uri } == true) return
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
        return nextPhase(current, "playback.resolve_audio")
    }

    /** 解析完成后才开始等音频数据；请求失败则单独记录等待重试的时间。 */
    @Synchronized
    fun onResolveFinished(span: ISpan?, status: SpanStatus) {
        if (span == null) return
        span.finish(status)
        val current = active?.takeIf { it.phase === span } ?: return
        nextPhase(current, if (status == SpanStatus.OK) "playback.await_audio_format" else "playback.await_retry")
    }

    /** 只记录当前起播期间的 CDN 操作，不采集下载、预加载或播放中的持续读取。 */
    @Synchronized
    fun startDataSourceSpan(uri: String?, name: String, host: String?, op: String = "http.client"): ISpan? {
        val current = active?.takeIf { uri != null && it.uri == uri } ?: return null
        val span = (current.phase ?: current.transaction).startChild(op, name)
        span.setData("bbplayer.source", "native")
        span.setData("http.request.method", "GET")
        host?.let { span.setData("server.address", it) }
        current.tasks.add(span)
        return span
    }

    @Synchronized
    fun finishDataSourceSpan(span: ISpan?, status: SpanStatus) {
        if (span == null) return
        active?.tasks?.remove(span)
        span.finish(status)
    }

    @Synchronized
    fun onAudioFormat(mediaId: String?, mime: String?) {
        val current = active?.takeIf { it.mediaId == mediaId && !it.formatSeen } ?: return
        current.formatSeen = true
        mime?.let { current.transaction.setData("audio.mime", it) }
        if (!current.outputSeen) nextPhase(current, "playback.await_audio_output")
    }

    /** 使用 Media3 的单调时钟时间戳补记实际解码器初始化，排除回调排队的时间。 */
    @Synchronized
    fun onDecoderInitialized(mediaId: String?, decoder: String, initializedAtMs: Long, durationMs: Long) {
        val current = active?.takeIf { it.mediaId == mediaId } ?: return
        val now = ScopesAdapter.getInstance().options.dateProvider.now().nanoTimestamp()
        val end = now - (SystemClock.elapsedRealtime() - initializedAtMs).coerceAtLeast(0) * 1_000_000
        val start = (end - durationMs.coerceAtLeast(0) * 1_000_000).coerceAtLeast(current.transaction.startDate.nanoTimestamp())
        // 复用旧解码器或迟到的回调不属于这次起播。
        if (end < start) return
        val span = current.transaction.startChild("playback", "playback.decoder_init", SentryLongDate(start))
        span.setData("audio.decoder", decoder)
        span.finish(SpanStatus.OK, SentryLongDate(end))
    }

    @Synchronized
    fun onAudioOutput(mediaId: String?) {
        val current = active?.takeIf { it.mediaId == mediaId && !it.outputSeen } ?: return
        current.outputSeen = true
        nextPhase(current, "playback.await_playing")
    }

    private fun nextPhase(current: Active, name: String): ISpan {
        current.phase?.finish(SpanStatus.OK)
        return current.transaction.startChild("playback", name).also { current.phase = it }
    }

    private fun start(mediaId: String, uri: String?, reason: String) {
        val transaction = Sentry.startTransaction(
            TransactionContext("playback.wait_for_audio", "playback"),
            TransactionOptions().apply { isBindToScope = false },
        )
        transaction.setData("track.id", mediaId)
        transaction.setData("playback.reason", reason)
        transaction.setData("bbplayer.source", "native")

        active = Active(transaction, mediaId, uri)
        nextPhase(checkNotNull(active), "playback.prepare")
        handler.postDelayed(timeoutRunnable, TIMEOUT_MS)
    }

    private fun finish(status: SpanStatus, flag: String? = null) {
        val current = active ?: return
        active = null
        handler.removeCallbacks(timeoutRunnable)
        flag?.let { current.transaction.setData(it, true) }
        current.phase?.finish(status)
        // 暂停、切歌、超时之后仍在加载的任务不能跨到下一次起播，也不能留成未结束的 span。
        current.tasks.forEach { it.finish(if (status == SpanStatus.OK) SpanStatus.CANCELLED else status) }
        current.transaction.finish(status)
    }
}
