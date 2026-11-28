package expo.modules.orpheus.manager

import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.Timeline
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ForwardingRenderer
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.RendererConfiguration
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.ForwardingAudioSink
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.SampleStream
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.orpheus.util.GeneralStorage
import expo.modules.orpheus.util.LoudnessStorage
import expo.modules.orpheus.util.calculateLoudnessGainDb
import expo.modules.orpheus.util.dbToLinear
import java.nio.ByteBuffer
import kotlin.math.roundToInt

/*
 * 响度均衡直接作用在 PCM 上，不再改 player.volume。
 *
 * 难点是让增益正好在两首歌的分界处切换。无缝切歌时 sink 不会重新 configure，但渲染器开始输出
 * 新流之前一定会先调用 AudioSink.setOutputStreamOffsetUs（MediaCodecAudioRenderer 在处理完旧流最后
 * 一个 buffer 之后，DecoderAudioRenderer 在新流第一个 buffer 之前），接着 handleDiscontinuity。
 * DefaultAudioSink 收到下一个 buffer 时会把处理器链 drain 到底再 flush。所以只要在
 * setOutputStreamOffsetUs 时记下新流，到处理器 flush 时再切换增益，旧流的每个采样就都用旧增益，
 * 新流的每个采样都用新增益。
 *
 * offsetUs 对应哪首歌，要从渲染器的 enable / replaceStream 拿到 MediaPeriodId，再到 Timeline 里查。
 * FfmpegAudioRenderer 是 final 的，所以用 ForwardingRenderer 包一层。
 */

/** 记录每个渲染器流（按 offsetUs 区分）属于哪个 period，所有调用都在播放线程 */
@UnstableApi
class LoudnessStreamTracker {
    private val lock = Any()
    private val periodUids = object : LinkedHashMap<Long, Any>() {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Long, Any>?) = size > MAX_STREAMS
    }

    @Volatile
    private var timeline: Timeline = Timeline.EMPTY

    fun onStream(offsetUs: Long, mediaPeriodId: MediaSource.MediaPeriodId) = synchronized(lock) {
        periodUids[offsetUs] = mediaPeriodId.periodUid
    }

    fun onTimeline(timeline: Timeline) {
        this.timeline = timeline
    }

    /** 该流对应的媒体 URI，也就是 LoudnessStorage 的键 */
    fun loudnessKeyFor(offsetUs: Long): String? {
        val periodUid = synchronized(lock) { periodUids[offsetUs] } ?: return null
        val timeline = timeline
        val periodIndex = timeline.getIndexOfPeriod(periodUid)
        if (periodIndex == C.INDEX_UNSET) return null
        val windowIndex = timeline.getPeriod(periodIndex, Timeline.Period()).windowIndex
        return timeline.getWindow(windowIndex, Timeline.Window()).mediaItem.localConfiguration?.uri?.toString()
    }

    private companion object {
        const val MAX_STREAMS = 16
    }
}

/** 把流的起止告诉 [LoudnessStreamTracker]，其余全部原样转发 */
@UnstableApi
class LoudnessTrackingRenderer(
    renderer: Renderer,
    private val tracker: LoudnessStreamTracker,
) : ForwardingRenderer(renderer) {
    // 必须先登记：enable / replaceStream 内部可能立即调用 sink.setOutputStreamOffsetUs
    override fun enable(
        configuration: RendererConfiguration,
        formats: Array<out Format>,
        stream: SampleStream,
        positionUs: Long,
        joining: Boolean,
        mayRenderStartOfStream: Boolean,
        startPositionUs: Long,
        offsetUs: Long,
        mediaPeriodId: MediaSource.MediaPeriodId,
    ) {
        tracker.onStream(offsetUs, mediaPeriodId)
        super.enable(
            configuration,
            formats,
            stream,
            positionUs,
            joining,
            mayRenderStartOfStream,
            startPositionUs,
            offsetUs,
            mediaPeriodId,
        )
    }

    override fun replaceStream(
        formats: Array<out Format>,
        stream: SampleStream,
        startPositionUs: Long,
        offsetUs: Long,
        mediaPeriodId: MediaSource.MediaPeriodId,
    ) {
        tracker.onStream(offsetUs, mediaPeriodId)
        super.replaceStream(formats, stream, startPositionUs, offsetUs, mediaPeriodId)
    }

    override fun setTimeline(timeline: Timeline) {
        tracker.onTimeline(timeline)
        super.setTimeline(timeline)
    }
}

/** 渲染器切换到新流时通知 [LoudnessGainProcessor] */
@UnstableApi
class LoudnessAudioSink(
    sink: AudioSink,
    private val processor: LoudnessGainProcessor,
) : ForwardingAudioSink(sink) {
    override fun setOutputStreamOffsetUs(outputStreamOffsetUs: Long) {
        super.setOutputStreamOffsetUs(outputStreamOffsetUs)
        processor.onStreamStarted(outputStreamOffsetUs)
    }

    // 开启均衡时拒绝直通：sink 接受压缩格式的话，MediaCodecAudioRenderer 会把压缩数据原样交给 sink，
    // 不经过处理器链，增益就不会生效。拒绝后渲染器会解码成 PCM；系统没有对应解码器时由 FfmpegAudioRenderer 解码。
    // 杜比格式例外：直通是保留全景声最可靠的路，为了响度均衡放弃它得不偿失，所以杜比音轨照常直通、不做均衡。
    // 渲染器能力在选轨时确定，切换开关后从下一首开始生效
    override fun supportsFormat(format: Format): Boolean =
        !rejectsPassthrough(format) && super.supportsFormat(format)

    override fun getFormatSupport(format: Format): Int =
        if (rejectsPassthrough(format)) AudioSink.SINK_FORMAT_UNSUPPORTED else super.getFormatSupport(format)

    private fun rejectsPassthrough(format: Format) =
        format.sampleMimeType != MimeTypes.AUDIO_RAW &&
            !DolbySupport.isDolbyMimeType(format.sampleMimeType) &&
            GeneralStorage.isLoudnessNormalizationEnabled()
}

/**
 * 按当前流的响度数据给 PCM 乘增益。
 *
 * 只能放在 DefaultAudioSink 的 audioProcessorChain 里（setAudioProcessors），那里的输入一定是
 * 16 位整数 PCM：开启 float 输出时 DefaultAudioSink 不会经过这条链，所以不要开启 float 输出。
 * 增益越界时硬限幅；提升量已经按真峰值留了余量，正常情况下碰不到。
 */
@UnstableApi
class LoudnessGainProcessor(private val tracker: LoudnessStreamTracker) : BaseAudioProcessor() {
    // 以下字段只在播放线程访问
    private var pendingStreamOffsetUs = C.TIME_UNSET
    private var streamGain = 1f
    private var currentGain = 1f
    private var rampTarget = 1f
    private var rampStep = 0f
    private var rampFramesLeft = 0

    fun onStreamStarted(offsetUs: Long) {
        pendingStreamOffsetUs = offsetUs
    }

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        return when (inputAudioFormat.encoding) {
            C.ENCODING_PCM_16BIT, C.ENCODING_PCM_FLOAT -> inputAudioFormat
            else -> AudioProcessor.AudioFormat.NOT_SET // 其他编码不处理，原样通过
        }
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val size = inputBuffer.remaining()
        if (size == 0) return
        val output = replaceOutputBuffer(size)

        val target = targetGain()
        if (target != rampTarget) startRamp(target)
        if (currentGain == 1f && rampFramesLeft == 0) {
            output.put(inputBuffer)
            output.flip()
            return
        }

        val channels = inputAudioFormat.channelCount
        when (inputAudioFormat.encoding) {
            C.ENCODING_PCM_16BIT -> {
                val frameSize = 2 * channels
                while (inputBuffer.remaining() >= frameSize) {
                    val gain = nextFrameGain()
                    repeat(channels) {
                        val value = (inputBuffer.getShort() * gain).roundToInt()
                        output.putShort(value.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort())
                    }
                }
            }
            C.ENCODING_PCM_FLOAT -> {
                val frameSize = 4 * channels
                while (inputBuffer.remaining() >= frameSize) {
                    val gain = nextFrameGain()
                    repeat(channels) {
                        output.putFloat((inputBuffer.getFloat() * gain).coerceIn(-1f, 1f))
                    }
                }
            }
        }
        // 不足一帧的尾巴（正常不会出现）原样带过
        output.put(inputBuffer)
        output.flip()
    }

    override fun onFlush(streamMetadata: AudioProcessor.StreamMetadata) {
        val offsetUs = pendingStreamOffsetUs
        if (offsetUs != C.TIME_UNSET) {
            pendingStreamOffsetUs = C.TIME_UNSET
            streamGain = resolveStreamGain(offsetUs)
        }
        // flush 是不连续点，直接跳到目标值，不需要过渡
        val target = targetGain()
        currentGain = target
        rampTarget = target
        rampFramesLeft = 0
    }

    override fun onReset() {
        streamGain = 1f
        currentGain = 1f
        rampTarget = 1f
        rampFramesLeft = 0
    }

    private fun targetGain() = if (GeneralStorage.isLoudnessNormalizationEnabled()) streamGain else 1f

    /** 播放中途开关均衡时平滑过渡，避免爆音 */
    private fun startRamp(target: Float) {
        val frames = (inputAudioFormat.sampleRate * RAMP_MS / 1000).coerceAtLeast(1)
        rampTarget = target
        rampStep = (target - currentGain) / frames
        rampFramesLeft = frames
    }

    private fun nextFrameGain(): Float {
        if (rampFramesLeft > 0) {
            rampFramesLeft--
            currentGain = if (rampFramesLeft == 0) rampTarget else currentGain + rampStep
        }
        return currentGain
    }

    private fun resolveStreamGain(offsetUs: Long): Float {
        val key = tracker.loudnessKeyFor(offsetUs)
        val gainDb = key?.let {
            calculateLoudnessGainDb(LoudnessStorage.getLoudnessData(it), LoudnessStorage.getTruePeak(it))
        } ?: 0.0
        activeGainDb = gainDb
        NativeLog.debug(
            LogTags.LOUDNESS,
            "audio.loudness.stream_gain_applied",
            mapOf("track.id" to key, "audio.gain_db" to gainDb),
        )
        return dbToLinear(gainDb)
    }

    companion object {
        private const val RAMP_MS = 50

        /** 最近一次切换到的流增益（dB），给调试面板看 */
        @Volatile
        var activeGainDb = 0.0
            private set
    }
}
