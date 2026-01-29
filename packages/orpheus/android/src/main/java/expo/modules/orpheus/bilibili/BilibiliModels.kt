package expo.modules.orpheus.bilibili

import com.google.gson.annotations.SerializedName

data class BilibiliApiResponse<TData>(
    val code: Int,
    val message: String,
    val data: TData?
)

data class BilibiliAudioStreamResponse(
    val durl: List<DurlItem>?,

    val dash: DashData?,

    val volume: VolumeData?
)

data class DurlItem(
    val order: Int,
    val url: String,
    @SerializedName("backup_url") val backupUrl: List<String>?
)

data class DashData(
    val audio: List<DashAudioItem>?,
    val dolby: DolbyData?,
    val flac: FlacData?
)

data class DashAudioItem(
    val id: Int,
    @SerializedName("base_url") val baseUrl: String,
    @SerializedName("backup_url") val backupUrl: List<String>?
)

data class DolbyData(
    val type: Int,
    val audio: List<DashAudioItem>?
)

data class FlacData(
    val display: Boolean,
    val audio: DashAudioItem?
)

data class VolumeData(
    @SerializedName("measured_i") val measuredI: Double,
    @SerializedName("target_i") val targetI: Double
)

data class BilibiliNavResponse(
    val code: Int,
    val data: NavData?
)

data class NavData(
    @SerializedName("wbi_img") val wbiImg: WbiImgData?
)

data class WbiImgData(
    @SerializedName("img_url") val imgUrl: String,
    @SerializedName("sub_url") val subUrl: String
)

data class BilibiliPageListResponse(
    val cid: Long
)