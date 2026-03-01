package expo.modules.orpheus.bilibili

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class BilibiliApiResponse<TData>(
    @SerialName("code") val code: Int,
    @SerialName("message") val message: String? = null,
    @SerialName("data") val data: TData? = null
)

@Serializable
data class BilibiliAudioStreamResponse(
    @SerialName("durl") val durl: List<DurlItem>? = null,

    @SerialName("dash") val dash: DashData? = null,

    @SerialName("volume") val volume: VolumeData? = null
)

@Serializable
data class DurlItem(
    @SerialName("order") val order: Int,
    @SerialName("url") val url: String,
    @SerialName("backup_url") val backupUrl: List<String>?
)

@Serializable
data class DashData(
    @SerialName("audio") val audio: List<DashAudioItem>?,
    @SerialName("dolby") val dolby: DolbyData?,
    @SerialName("flac") val flac: FlacData?
)

@Serializable
data class DashAudioItem(
    @SerialName("id") val id: Int,
    @SerialName("base_url") val baseUrl: String,
    @SerialName("backup_url") val backupUrl: List<String>?
)

@Serializable
data class DolbyData(
    @SerialName("type") val type: Int,
    @SerialName("audio") val audio: List<DashAudioItem>?
)

@Serializable
data class FlacData(
    @SerialName("display") val display: Boolean,
    @SerialName("audio") val audio: DashAudioItem?
)

@Serializable
data class VolumeData(
    @SerialName("measured_i") val measuredI: Double,
    @SerialName("target_i") val targetI: Double
)

@Serializable
data class BilibiliNavResponse(
    @SerialName("code") val code: Int,
    @SerialName("message") val message: String? = null,
    @SerialName("data") val data: NavData?
)

@Serializable
data class NavData(
    @SerialName("wbi_img") val wbiImg: WbiImgData?
)

@Serializable
data class WbiImgData(
    @SerialName("img_url") val imgUrl: String,
    @SerialName("sub_url") val subUrl: String
)

@Serializable
data class BilibiliPageListResponse(
    @SerialName("cid") val cid: Long
)