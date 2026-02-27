package expo.modules.orpheus.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LyricsLine(
    @SerialName("timestamp") val timestamp: Double,
    @SerialName("text") val text: String,
    @SerialName("translation") val translation: String? = null
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
