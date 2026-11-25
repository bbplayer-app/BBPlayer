package expo.modules.orpheus.manager

import android.content.Context
import android.os.Handler
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.decoder.ffmpeg.FfmpegLibrary
import androidx.media3.exoplayer.RendererCapabilities
import androidx.media3.exoplayer.audio.AudioRendererEventListener
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.MediaCodecAudioRenderer
import androidx.media3.exoplayer.mediacodec.MediaCodecAdapter
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector

/**
 * 常见格式让给排在它后面的 FfmpegAudioRenderer 在进程内解码，其余格式（杜比等）仍由 MediaCodec 处理。
 *
 * 系统的软解码器跑在 media.swcodec 进程里，每块数据都要跨进程，解码器的每次回调还会唤醒播放线程。
 */
@UnstableApi
class FfmpegFirstMediaCodecAudioRenderer(
    context: Context,
    codecAdapterFactory: MediaCodecAdapter.Factory,
    mediaCodecSelector: MediaCodecSelector,
    enableDecoderFallback: Boolean,
    eventHandler: Handler?,
    eventListener: AudioRendererEventListener?,
    audioSink: AudioSink,
    /** 为 false 时不让给 FFmpeg（测量用的“强制 MediaCodec”） */
    private val preferFfmpeg: Boolean,
) : MediaCodecAudioRenderer(
    context,
    codecAdapterFactory,
    mediaCodecSelector,
    enableDecoderFallback,
    eventHandler,
    eventListener,
    audioSink,
) {
    override fun supportsFormat(mediaCodecSelector: MediaCodecSelector, format: Format): Int {
        val capabilities = super.supportsFormat(mediaCodecSelector, format)
        if (!preferFfmpeg || format.sampleMimeType !in FFMPEG_MIME_TYPES) return capabilities
        if (!FfmpegLibrary.isAvailable() || !FfmpegLibrary.supportsFormat(format.sampleMimeType!!)) {
            return capabilities
        }
        return RendererCapabilities.create(C.FORMAT_UNSUPPORTED_SUBTYPE)
    }

    /**
     * B 站的 FLAC 是分片 MP4，容器里没有最大帧大小，Media3 不设置 KEY_MAX_INPUT_SIZE，
     * 系统解码器就用默认的 32KB。Hi-Res（96kHz 等）FLAC 的单帧可能超过 32KB，
     * 读到这样的帧时会抛 InsufficientCapacityException，播放器报 ERROR_CODE_FAILED_RUNTIME_CHECK 停止。
     */
    override fun getCodecMaxInputSize(
        codecInfo: MediaCodecInfo,
        format: Format,
        streamFormats: Array<out Format>,
    ): Int {
        val maxInputSize = super.getCodecMaxInputSize(codecInfo, format, streamFormats)
        if (format.sampleMimeType == MimeTypes.AUDIO_FLAC && maxInputSize < FLAC_MIN_INPUT_SIZE) {
            return FLAC_MIN_INPUT_SIZE
        }
        return maxInputSize
    }

    private companion object {
        // 足够放下常见的高采样率、24 位立体声 FLAC 帧（实测 96kHz 的单帧约 33KB）
        const val FLAC_MIN_INPUT_SIZE = 256 * 1024

        // 只接管系统本来就用软解的常见格式。杜比（AC-3、E-AC-3）等留给 MediaCodec，
        // 设备可能有硬件解码器
        val FFMPEG_MIME_TYPES = setOf(
            MimeTypes.AUDIO_AAC,
            MimeTypes.AUDIO_FLAC,
            MimeTypes.AUDIO_MPEG,
            MimeTypes.AUDIO_OPUS,
            MimeTypes.AUDIO_VORBIS,
        )
    }
}
