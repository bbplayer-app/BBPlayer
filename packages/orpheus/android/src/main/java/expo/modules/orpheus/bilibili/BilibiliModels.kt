package expo.modules.orpheus.bilibili

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName

@Keep
data class BilibiliApiResponse<TData>(
    val code: Int,
    val message: String,
    val data: TData?
)

@Keep
data class BilibiliAudioStreamResponse(
    val durl: List<DurlItem>?,

    val dash: DashData?,

    val volume: VolumeData?
)

@Keep
data class DurlItem(
    val order: Int,
    val url: String,
    @SerializedName("backup_url") val backupUrl: List<String>?
)

@Keep
data class DashData(
    val audio: List<DashAudioItem>?,
    val dolby: DolbyData?,
    val flac: FlacData?
)

@Keep
data class DashAudioItem(
    val id: Int,
    @SerializedName("base_url") val baseUrl: String,
    @SerializedName("backup_url") val backupUrl: List<String>?
)

@Keep
data class DolbyData(
    val type: Int,
    val audio: List<DashAudioItem>?
)

@Keep
data class FlacData(
    val display: Boolean,
    val audio: DashAudioItem?
)

@Keep
data class VolumeData(
    @SerializedName("measured_i") val measuredI: Double,
    @SerializedName("target_i") val targetI: Double
)

@Keep
data class BilibiliNavResponse(
    val code: Int,
    val data: NavData?
)

@Keep
data class NavData(
    @SerializedName("wbi_img") val wbiImg: WbiImgData?
)

@Keep
data class WbiImgData(
    @SerializedName("img_url") val imgUrl: String,
    @SerializedName("sub_url") val subUrl: String
)

@Keep
data class BilibiliPageListResponse(
    val cid: Long
)