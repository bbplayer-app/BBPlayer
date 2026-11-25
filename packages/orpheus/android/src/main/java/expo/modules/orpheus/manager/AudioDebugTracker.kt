package expo.modules.orpheus.manager

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.SystemClock
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaLibraryInfo
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.exoplayer.DecoderReuseEvaluation
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.source.LoadEventInfo
import androidx.media3.exoplayer.source.MediaLoadData
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.OrpheusTelemetry
import expo.modules.orpheus.telemetry.PlaybackTracer
import expo.modules.orpheus.util.GeneralStorage
import java.util.Locale

/**
 * 收集音频播放的调试信息，供 App 内的音频调试页展示，同时把音频管线的状态变化写进日志和 Sentry context。
 * 回调与 [snapshot] 都在主线程（ExoPlayer 的 application looper）上执行。
 */
@UnstableApi
class AudioDebugTracker : AnalyticsListener {
    private var decoderName: String? = null
    private var decoderInitDurationMs = 0L
    private var decoderInitAtMs = 0L
    private var inputFormat: Format? = null

    @Volatile
    var onAudioFormatChangedListener: ((Format) -> Unit)? = null

    /** 解码器与输入格式属于哪首歌：出错时它可能还是上一首的，不能和当前歌曲混为一谈 */
    private var audioMediaId: String? = null

    private var audioTrackConfig: AudioSink.AudioTrackConfig? = null
    // 旧 AudioTrack 的释放回调可能晚于新 AudioTrack 创建，所以按数量判断还有没有输出，
    // 不能一收到释放就清空配置
    private var liveAudioTrackCount = 0
    private var audioTrackInitAtMs = 0L

    private var underrunCount = 0
    private var lastUnderrunAtMs = 0L
    private var lastUnderrunBufferMs = 0L
    private var lastUnderrunSinceFeedMs = 0L

    private var sinkErrorCount = 0
    private var codecErrorCount = 0
    private var lastAudioError: String? = null

    private var bitrateEstimate = 0L
    private var activeLoads = 0
    private var lastLoadStartHost: String? = null
    private var lastLoadStartAtMs = 0L
    private var loadCount = 0
    private var bytesLoaded = 0L
    private var lastLoadHost: String? = null
    private var lastLoadDurationMs = 0L
    private var lastLoadBytes = 0L
    private var lastLoadAtMs = 0L

    override fun onAudioDecoderInitialized(
        eventTime: AnalyticsListener.EventTime,
        decoderName: String,
        initializedTimestampMs: Long,
        initializationDurationMs: Long
    ) {
        this.decoderName = decoderName
        decoderInitDurationMs = initializationDurationMs
        decoderInitAtMs = SystemClock.elapsedRealtime()
        audioMediaId = mediaIdOf(eventTime)
        PlaybackTracer.onDecoderInitialized(audioMediaId, decoderName, initializedTimestampMs, initializationDurationMs)
        NativeLog.info(
            LogTags.AUDIO,
            "audio.decoder.initialized",
            mapOf(
                "track.id" to audioMediaId,
                "audio.decoder" to decoderName,
                "audio.initialization_duration_ms" to initializationDurationMs,
            ),
        )
        OrpheusTelemetry.update("decoder" to decoderName, "audioMediaId" to audioMediaId)
        OrpheusTelemetry.setTag("orpheus.decoder", decoderName)
    }

    override fun onAudioInputFormatChanged(
        eventTime: AnalyticsListener.EventTime,
        format: Format,
        decoderReuseEvaluation: DecoderReuseEvaluation?
    ) {
        inputFormat = format
        audioMediaId = mediaIdOf(eventTime)
        PlaybackTracer.onAudioFormat(audioMediaId, format.sampleMimeType)
        NativeLog.info(
            LogTags.AUDIO,
            "audio.format.changed",
            mapOf(
                "track.id" to audioMediaId,
                "audio.format" to Format.toLogString(format),
            ),
        )
        OrpheusTelemetry.update("inputFormat" to Format.toLogString(format), "audioMediaId" to audioMediaId)
        OrpheusTelemetry.setTag("orpheus.mime", format.sampleMimeType)
        runCatching { onAudioFormatChangedListener?.invoke(format) }
    }

    fun getCurrentInputFormat(): Format? = inputFormat

    override fun onAudioTrackInitialized(
        eventTime: AnalyticsListener.EventTime,
        audioTrackConfig: AudioSink.AudioTrackConfig
    ) {
        this.audioTrackConfig = audioTrackConfig
        audioTrackInitAtMs = SystemClock.elapsedRealtime()
        liveAudioTrackCount++
        PlaybackTracer.onAudioOutput(mediaIdOf(eventTime))
        val output = outputMode(audioTrackConfig)
        NativeLog.info(
            LogTags.AUDIO,
            "audio.track.initialized",
            mapOf(
                "audio.output" to output,
                "audio.encoding" to encodingName(audioTrackConfig.encoding),
                "audio.sample_rate_hz" to audioTrackConfig.sampleRate,
                "audio.buffer_size_bytes" to audioTrackConfig.bufferSize,
            ),
        )
        OrpheusTelemetry.update(
            "audioTrack" to mapOf(
                "output" to output,
                "encoding" to encodingName(audioTrackConfig.encoding),
                "sampleRate" to audioTrackConfig.sampleRate,
                "bufferSize" to audioTrackConfig.bufferSize,
            ),
        )
        OrpheusTelemetry.setTag("orpheus.output", output)
    }

    override fun onAudioTrackReleased(
        eventTime: AnalyticsListener.EventTime,
        audioTrackConfig: AudioSink.AudioTrackConfig
    ) {
        liveAudioTrackCount = maxOf(0, liveAudioTrackCount - 1)
        if (liveAudioTrackCount == 0) this.audioTrackConfig = null
        NativeLog.debug(
            LogTags.AUDIO,
            "audio.track.released",
            mapOf(
                "audio.output" to outputMode(audioTrackConfig),
                "audio.live_track_count" to liveAudioTrackCount,
            ),
        )
    }

    override fun onAudioUnderrun(
        eventTime: AnalyticsListener.EventTime,
        bufferSize: Int,
        bufferSizeMs: Long,
        elapsedSinceLastFeedMs: Long
    ) {
        underrunCount++
        lastUnderrunAtMs = SystemClock.elapsedRealtime()
        lastUnderrunBufferMs = bufferSizeMs
        lastUnderrunSinceFeedMs = elapsedSinceLastFeedMs
        NativeLog.warning(
            LogTags.AUDIO,
            "audio.underrun",
            logAttributes() + mapOf(
                "audio.error_count" to underrunCount,
                "audio.buffer_ms" to bufferSizeMs,
                "audio.since_last_feed_ms" to elapsedSinceLastFeedMs,
            ),
        )
        OrpheusTelemetry.update("underrunCount" to underrunCount)
    }

    override fun onAudioSinkError(eventTime: AnalyticsListener.EventTime, audioSinkError: Exception) {
        sinkErrorCount++
        lastAudioError = audioSinkError.toString()
        // 可恢复的错误：播放器会重建 AudioTrack 继续播放，致命错误另由 onPlayerError 报告
        NativeLog.warning(
            LogTags.AUDIO,
            "audio.sink.failed",
            logAttributes() + mapOf("audio.error_count" to sinkErrorCount),
            audioSinkError,
        )
        OrpheusTelemetry.update("sinkErrorCount" to sinkErrorCount, "lastAudioError" to lastAudioError)
    }

    override fun onAudioCodecError(eventTime: AnalyticsListener.EventTime, audioCodecError: Exception) {
        codecErrorCount++
        lastAudioError = audioCodecError.toString()
        // 可恢复的错误，但它常常是随后致命错误的真正原因（例如 FLAC 帧超过解码器输入缓冲）
        NativeLog.warning(
            LogTags.AUDIO,
            "audio.codec.failed",
            logAttributes() + mapOf("audio.error_count" to codecErrorCount),
            audioCodecError,
        )
        OrpheusTelemetry.update("codecErrorCount" to codecErrorCount, "lastAudioError" to lastAudioError)
    }

    override fun onBandwidthEstimate(
        eventTime: AnalyticsListener.EventTime,
        totalLoadTimeMs: Int,
        totalBytesLoaded: Long,
        bitrateEstimate: Long
    ) {
        this.bitrateEstimate = bitrateEstimate
    }

    override fun onLoadStarted(
        eventTime: AnalyticsListener.EventTime,
        loadEventInfo: LoadEventInfo,
        mediaLoadData: MediaLoadData,
        retryCount: Int
    ) {
        activeLoads++
        lastLoadStartHost = loadEventInfo.uri.host
        lastLoadStartAtMs = SystemClock.elapsedRealtime()
    }

    override fun onLoadCanceled(
        eventTime: AnalyticsListener.EventTime,
        loadEventInfo: LoadEventInfo,
        mediaLoadData: MediaLoadData
    ) {
        activeLoads = (activeLoads - 1).coerceAtLeast(0)
    }

    override fun onLoadError(
        eventTime: AnalyticsListener.EventTime,
        loadEventInfo: LoadEventInfo,
        mediaLoadData: MediaLoadData,
        error: java.io.IOException,
        wasCanceled: Boolean
    ) {
        activeLoads = (activeLoads - 1).coerceAtLeast(0)
        // 播放器会重试，重试耗尽才会变成 onPlayerError
        NativeLog.warning(
            LogTags.STREAM,
            "stream.load.failed",
            logAttributes() + mapOf(
                "stream.host" to loadEventInfo.uri.host,
                "stream.bytes_loaded_bytes" to loadEventInfo.bytesLoaded,
                "stream.canceled" to wasCanceled,
            ),
            error,
        )
    }

    override fun onLoadCompleted(
        eventTime: AnalyticsListener.EventTime,
        loadEventInfo: LoadEventInfo,
        mediaLoadData: MediaLoadData
    ) {
        activeLoads = (activeLoads - 1).coerceAtLeast(0)
        loadCount++
        bytesLoaded += loadEventInfo.bytesLoaded
        lastLoadHost = loadEventInfo.uri.host
        lastLoadDurationMs = loadEventInfo.loadDurationMs
        lastLoadBytes = loadEventInfo.bytesLoaded
        lastLoadAtMs = SystemClock.elapsedRealtime()
    }

    /** 显式选择诊断字段，避免把 Format 或播放器对象整体上传。 */
    fun logAttributes(): Map<String, Any?> = mapOf(
        "track.id" to audioMediaId,
        "audio.decoder" to decoderName,
        "audio.mime" to inputFormat?.sampleMimeType,
        "audio.sample_rate_hz" to inputFormat?.sampleRate,
        "audio.channel_count" to inputFormat?.channelCount,
        "audio.output" to audioTrackConfig?.let(::outputMode),
    )

    /** 报错时附上的音频状态，用于在日志里直接看出是哪种格式、哪个解码器出的问题 */
    fun describeAudioState(): String {
        val format = inputFormat
        return "audioMediaId=$audioMediaId decoder=$decoderName format=${format?.let { Format.toLogString(it) }} " +
            "output=${audioTrackConfig?.let(::outputMode)}"
    }

    private fun mediaIdOf(eventTime: AnalyticsListener.EventTime): String? {
        if (eventTime.timeline.isEmpty) return null
        return eventTime.timeline.getWindow(eventTime.windowIndex, Timeline.Window()).mediaItem.mediaId
    }

    private fun outputMode(config: AudioSink.AudioTrackConfig) =
        if (isPcm(config.encoding)) "pcm" else "passthrough"

    /** 按分组返回可直接展示的字符串 */
    fun snapshot(context: Context, player: ExoPlayer): List<Map<String, Any>> {
        val now = SystemClock.elapsedRealtime()
        val sections = mutableListOf<Map<String, Any>>()

        fun section(title: String, vararg items: Pair<String, String?>) {
            sections += mapOf(
                "title" to title,
                "items" to items.map { (label, value) -> mapOf("label" to label, "value" to (value ?: "—")) },
            )
        }

        val bufferedAheadMs = (player.bufferedPosition - player.currentPosition).coerceAtLeast(0)
        val uri = player.currentMediaItem?.localConfiguration?.uri?.toString()
        section(
            "播放状态",
            "状态" to playbackStateName(player.playbackState),
            "正在播放" to yesNo(player.isPlaying),
            "播放位置" to "${formatSeconds(player.currentPosition)} / ${formatSeconds(player.duration)}",
            "已缓冲（领先播放位置）" to "${bufferedAheadMs / 1000.0}s",
            "倍速 / 音调" to "${player.playbackParameters.speed}x / ${player.playbackParameters.pitch}",
            "音量" to String.format(Locale.US, "%.3f", player.volume),
            "响度均衡增益" to if (GeneralStorage.isLoudnessNormalizationEnabled()) {
                String.format(Locale.US, "%+.1f dB", LoudnessGainProcessor.activeGainDb)
            } else {
                "已关闭"
            },
            "音频会话 ID" to player.audioSessionId.toString(),
            "来源主机" to uri?.let { android.net.Uri.parse(it).host ?: it.substringBefore("://") },
            "已完整缓存" to uri?.let { yesNo(CachedUriManager.isFullyCached(it)) },
        )

        val format = inputFormat ?: player.audioFormat
        section(
            "音频格式（解码器输入）",
            "MIME" to format?.sampleMimeType,
            "codecs" to format?.codecs,
            "采样率" to format?.sampleRate?.takeIf { it != Format.NO_VALUE }?.let { "$it Hz" },
            "声道数" to format?.channelCount?.takeIf { it != Format.NO_VALUE }?.toString(),
            "码率" to format?.let { formatBitrate(if (it.averageBitrate != Format.NO_VALUE) it.averageBitrate else it.bitrate) },
            "编码器延迟 / 填充" to format?.let { "${it.encoderDelay} / ${it.encoderPadding} 帧" },
        )

        val counters = player.audioDecoderCounters
        section(
            "解码器",
            "解码器" to decoderName,
            "初始化耗时" to decoderName?.let { "${decoderInitDurationMs}ms（${formatAgo(now - decoderInitAtMs)}）" },
            "已送入 / 已输出 buffer" to counters?.let { "${it.queuedInputBufferCount} / ${it.renderedOutputBufferCount}" },
            "跳过 / 丢弃 buffer" to counters?.let { "${it.skippedOutputBufferCount} / ${it.droppedBufferCount}" },
            "解码器错误" to codecErrorCount.toString(),
        )

        val track = audioTrackConfig
        section(
            "音频输出（AudioTrack）",
            "输出模式" to track?.let { if (isPcm(it.encoding)) "PCM" else "直通" },
            "编码" to track?.let { encodingName(it.encoding) },
            "采样率" to track?.let { "${it.sampleRate} Hz" },
            "缓冲大小" to track?.let { formatTrackBuffer(it) },
            "隧道模式" to track?.let { yesNo(it.tunneling) },
            "创建于" to track?.let { formatAgo(now - audioTrackInitAtMs) },
            "欠载（underrun）次数" to underrunCount.toString(),
            "最近一次欠载" to if (underrunCount > 0) {
                "${formatAgo(now - lastUnderrunAtMs)}，缓冲 ${lastUnderrunBufferMs}ms，距上次写入 ${lastUnderrunSinceFeedMs}ms"
            } else null,
            "AudioSink 错误" to sinkErrorCount.toString(),
            "最近一次音频错误" to lastAudioError,
        )

        section(
            "网络",
            "带宽估计" to if (bitrateEstimate > 0) formatBitrate(bitrateEstimate) else null,
            "进行中的加载" to if (activeLoads > 0) {
                "$activeLoads 个（最近开始：${lastLoadStartHost ?: "?"}，${formatAgo(now - lastLoadStartAtMs)}）"
            } else "无",
            "已完成加载 / 累计下载" to "$loadCount 次 / ${formatBytes(bytesLoaded)}",
            "最近一次加载" to if (loadCount > 0) {
                "${lastLoadHost ?: "?"}，${formatBytes(lastLoadBytes)}，耗时 ${lastLoadDurationMs}ms（${formatAgo(now - lastLoadAtMs)}）"
            } else null,
        )

        section(
            "其他",
            "输出设备" to outputDevices(context, player),
            "频谱采集中" to yesNo(SpectrumAnalyzer.isCapturing),
            "强制 MediaCodec（测量开关）" to yesNo(GeneralStorage.isTestForceMediaCodec()),
            "动态调度" to "开",
            "Media3 版本" to MediaLibraryInfo.VERSION,
        )

        return sections
    }

    private fun outputDevices(context: Context, player: ExoPlayer): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "需要 Android 13+ 才能查询"
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val devices = audioManager.getAudioDevicesForAttributes(
            player.audioAttributes.getPlatformAudioAttributes()
        )
        if (devices.isEmpty()) return "—"
        return devices.joinToString("、") { "${deviceTypeName(it.type)}（${it.productName}）" }
    }

    private fun deviceTypeName(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "扬声器"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> "有线耳机"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "蓝牙 A2DP"
        AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_BLE_SPEAKER -> "蓝牙 LE Audio"
        AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE -> "USB 音频"
        else -> "类型 $type"
    }

    private fun formatTrackBuffer(config: AudioSink.AudioTrackConfig): String {
        if (!isPcm(config.encoding)) return formatBytes(config.bufferSize.toLong())
        val channels = Integer.bitCount(config.channelConfig).coerceAtLeast(1)
        val bytesPerFrame = Util.getPcmFrameSize(config.encoding, channels)
        val ms = config.bufferSize.toLong() * 1000 / (bytesPerFrame.toLong() * config.sampleRate)
        return "${formatBytes(config.bufferSize.toLong())}（约 ${ms}ms）"
    }

    private fun isPcm(encoding: Int) = Util.isEncodingLinearPcm(encoding)

    private fun encodingName(encoding: Int): String = when (encoding) {
        C.ENCODING_PCM_16BIT -> "PCM 16bit"
        C.ENCODING_PCM_FLOAT -> "PCM float"
        C.ENCODING_PCM_24BIT -> "PCM 24bit"
        C.ENCODING_PCM_32BIT -> "PCM 32bit"
        C.ENCODING_AAC_LC -> "AAC LC"
        C.ENCODING_AAC_HE_V1 -> "HE-AAC v1"
        C.ENCODING_AAC_HE_V2 -> "HE-AAC v2"
        C.ENCODING_MP3 -> "MP3"
        C.ENCODING_OPUS -> "Opus"
        C.ENCODING_E_AC3, C.ENCODING_E_AC3_JOC -> "E-AC-3"
        C.ENCODING_AC3 -> "AC-3"
        else -> "编码 $encoding"
    }

    private fun playbackStateName(state: Int) = when (state) {
        Player.STATE_IDLE -> "IDLE"
        Player.STATE_BUFFERING -> "BUFFERING"
        Player.STATE_READY -> "READY"
        Player.STATE_ENDED -> "ENDED"
        else -> state.toString()
    }

    private fun yesNo(value: Boolean) = if (value) "是" else "否"

    private fun formatSeconds(ms: Long): String {
        if (ms == C.TIME_UNSET || ms < 0) return "—"
        val totalSeconds = ms / 1000
        return String.format(Locale.US, "%d:%02d", totalSeconds / 60, totalSeconds % 60)
    }

    private fun formatAgo(ms: Long): String = when {
        ms < 1000 -> "刚刚"
        ms < 60_000 -> "${ms / 1000} 秒前"
        ms < 3_600_000 -> "${ms / 60_000} 分钟前"
        else -> "${ms / 3_600_000} 小时前"
    }

    private fun formatBitrate(bitsPerSecond: Int): String? =
        if (bitsPerSecond == Format.NO_VALUE) null else formatBitrate(bitsPerSecond.toLong())

    private fun formatBitrate(bitsPerSecond: Long): String =
        if (bitsPerSecond >= 1_000_000) {
            String.format(Locale.US, "%.2f Mbps", bitsPerSecond / 1_000_000.0)
        } else {
            "${bitsPerSecond / 1000} kbps"
        }

    private fun formatBytes(bytes: Long): String = when {
        bytes >= 1_048_576 -> String.format(Locale.US, "%.2f MB", bytes / 1_048_576.0)
        bytes >= 1024 -> String.format(Locale.US, "%.1f KB", bytes / 1024.0)
        else -> "$bytes B"
    }
}
