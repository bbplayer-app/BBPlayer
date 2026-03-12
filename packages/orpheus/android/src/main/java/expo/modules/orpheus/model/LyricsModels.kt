package expo.modules.orpheus.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LyricSpan(
    @SerialName("text") val text: String,
    @SerialName("startTime") val startTime: Long, // 毫秒
    @SerialName("endTime") val endTime: Long,     // 毫秒
    @SerialName("duration") val duration: Long    // 毫秒
)

@Serializable
data class LyricsLine(
    @SerialName("timestamp") val timestamp: Double, // 秒
    @SerialName("endTime") val endTime: Double? = null, // 秒
    @SerialName("text") val text: String,
    @SerialName("translation") val translation: String? = null,
    @SerialName("romaji") val romaji: String? = null,
    @SerialName("spans") val spans: List<LyricSpan>? = null
)

@Serializable
data class LyricsData(
    @SerialName("lyrics") val lyrics: List<LyricsLine>,
    @SerialName("offset") val offset: Double = 0.0
)

/** 歌词缓存文件的最小结构，忽略其他字段 */
@Serializable
data class LyricFileCache(
    @SerialName("lrc") val lrc: String? = null,
)
