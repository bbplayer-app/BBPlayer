package expo.modules.orpheus.manager

import android.content.Context
import android.media.MediaCodecList
import androidx.media3.common.AudioAttributes
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioCapabilities
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.LogTags

/**
 * 判断设备能不能真正播放 B 站的杜比全景声（E-AC-3 JOC）。
 *
 * 播放器处理杜比音轨的顺序是：直通（交给系统或外接设备）→ 系统解码器 → FFmpeg 软解。
 * FFmpeg 不处理 JOC 里的声音对象，只能解出 5.1 基础声道再下混，听不到全景声，
 * 所以只有前两条路可用时才算支持。
 */
@UnstableApi
object DolbySupport {
    const val LEVEL_ATMOS = "atmos"
    const val LEVEL_DOLBY = "dolby"
    const val LEVEL_NONE = "none"

    data class Info(
        /** atmos：能保留全景声；dolby：系统能解杜比数字+，但不保证有全景声；none：只能 FFmpeg 软解 */
        val level: String,
        val jocDecoders: List<String>,
        val eac3Decoders: List<String>,
        val jocPassthrough: Boolean,
        val eac3Passthrough: Boolean,
    ) {
        fun toMap(): Map<String, Any> = mapOf(
            "level" to level,
            "jocDecoders" to jocDecoders,
            "eac3Decoders" to eac3Decoders,
            "jocPassthrough" to jocPassthrough,
            "eac3Passthrough" to eac3Passthrough,
        )
    }

    @Volatile
    private var appContext: Context? = null

    // 系统解码器在运行期间不会变，查一次就够；直通取决于当前输出设备（例如接上 HDMI），每次现查
    private val decoders: Pair<List<String>, List<String>> by lazy {
        runCatching {
            val infos = MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.filter { !it.isEncoder }
            fun decodersOf(mime: String) = infos
                .filter { info -> info.supportedTypes.any { it.equals(mime, ignoreCase = true) } }
                .map { it.name }
            decodersOf(MimeTypes.AUDIO_E_AC3_JOC) to decodersOf(MimeTypes.AUDIO_E_AC3)
        }.getOrElse {
            NativeLog.warning(LogTags.AUDIO, "dolby.decoder_query.failed", error = it)
            emptyList<String>() to emptyList()
        }
    }

    fun init(context: Context) {
        if (appContext == null) appContext = context.applicationContext
    }

    fun current(): Info {
        val (jocDecoders, eac3Decoders) = decoders
        val capabilities = appContext?.let {
            runCatching { AudioCapabilities.getCapabilities(it, AudioAttributes.DEFAULT, null) }.getOrNull()
        }
        val jocPassthrough = capabilities?.isPassthroughPlaybackSupported(
            dolbyFormat(MimeTypes.AUDIO_E_AC3_JOC), AudioAttributes.DEFAULT
        ) == true
        val eac3Passthrough = capabilities?.isPassthroughPlaybackSupported(
            dolbyFormat(MimeTypes.AUDIO_E_AC3), AudioAttributes.DEFAULT
        ) == true
        val level = when {
            jocPassthrough || jocDecoders.isNotEmpty() -> LEVEL_ATMOS
            eac3Passthrough || eac3Decoders.isNotEmpty() -> LEVEL_DOLBY
            else -> LEVEL_NONE
        }
        return Info(level, jocDecoders, eac3Decoders, jocPassthrough, eac3Passthrough)
    }

    /** 设备只能软解时，杜比偏好按 Hi-Res 请求：软解的杜比只剩下混后的 5.1，不如无损 */
    fun isDolbyPlayable(): Boolean = current().level != LEVEL_NONE

    fun isDolbyMimeType(mimeType: String?): Boolean = when (mimeType) {
        MimeTypes.AUDIO_AC3, MimeTypes.AUDIO_E_AC3, MimeTypes.AUDIO_E_AC3_JOC, MimeTypes.AUDIO_AC4 -> true
        else -> false
    }

    private fun dolbyFormat(mimeType: String) = Format.Builder()
        .setSampleMimeType(mimeType)
        .setChannelCount(6)
        .setSampleRate(48_000)
        .build()
}
