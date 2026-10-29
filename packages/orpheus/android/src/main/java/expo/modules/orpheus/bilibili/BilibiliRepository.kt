package expo.modules.orpheus.bilibili

import android.util.Log

import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object BilibiliRepository {
    val TAG = "Orpheus/BilibiliRepo"

    private val api: BilibiliApi by lazy {
        NetworkModule.retrofit.create(BilibiliApi::class.java)
    }

    private var cachedImgKey: String? = null
    private var cachedSubKey: String? = null
    private var cachedDateStr: String? = null

    private fun getTodayDateStr(): String {
        val sdf = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return sdf.format(Date())
    }

    @Synchronized
    private fun getWbiKeys(): Pair<String, String> {
        val today = getTodayDateStr()

        if (cachedImgKey != null && cachedSubKey != null && today == cachedDateStr) {
            return cachedImgKey!! to cachedSubKey!!
        }

        val response = api.getNavInfo().execute()
        val wbiData = response.body()?.data?.wbiImg

        if (!response.isSuccessful || wbiData == null) {
            val msg = response.body()?.message ?: "Unknown Error"
            throw IOException("Bilibili API Error: code=${response.code()} msg=$msg")
        }

        val imgKey = WbiUtil.extractKey(wbiData.imgUrl)
        val subKey = WbiUtil.extractKey(wbiData.subUrl)

        cachedImgKey = imgKey
        cachedSubKey = subKey
        cachedDateStr = today

        return imgKey to subKey
    }

    /**
     * 解析音频 URL
     */
    fun resolveAudioUrls(
        bvid: String,
        cid: Long?,
        audioQuality: Int,
        enableDolby: Boolean,
        enableHiRes: Boolean,
        cookie: String?
    ): Pair<List<String>, VolumeData?> {
        var cidInternal = cid
        val (imgKey, subKey) = getWbiKeys()
        if (cidInternal === null) {
            cidInternal = getFirstCid(bvid, cookie)
        }

        Log.e(TAG, "resolve url: bvid: $bvid, cid: $cid, enableDolby: ")

        val rawParams = mapOf(
            "bvid" to bvid,
            "cid" to cidInternal,
            "fnval" to 4048,
            "fnver" to 0,
            "fourk" to 1,
            "qlt" to audioQuality,
            "voice_balance" to 1
        )

        val signedParams = WbiUtil.sign(rawParams, imgKey, subKey)

        val call = api.getPlayUrl(cookie, signedParams)
        val response = call.execute()

        if (!response.isSuccessful) {
            throw IOException("Bilibili API Http Error: ${response.code()}")
        }

        val apiResponse = response.body()
        if (apiResponse?.code != 0) {
            val msg = apiResponse?.message ?: "Unknown Error"
            throw IOException("Bilibili API Error: code=${apiResponse?.code} msg=$msg")
        }

        if (apiResponse.data == null) {
            throw IOException("Bilibili API Logic Error: code=0 msg=${apiResponse.message} but data is missing")
        }

        val data = apiResponse.data
        val dash = data.dash
        val durl = data.durl
        val volume = data.volume

        if (dash == null) {
            if (durl.isNullOrEmpty()) {
                throw IOException("AudioStreamError: 请求到的流数据不包含 dash 或 durl 任一字段")
            }
            return streamUrls(durl[0].url, durl[0].backupUrl) to volume
        }

        if (enableDolby && dash.dolby?.audio?.isNotEmpty() == true) {
            Log.d(TAG, "select dolby source")
            val audio = dash.dolby.audio[0]
            return streamUrls(audio.baseUrl, audio.backupUrl) to volume
        }

        if (enableHiRes && dash.flac?.audio != null) {
            Log.d(TAG, "select hires source")
            val audio = dash.flac.audio
            return streamUrls(audio.baseUrl, audio.backupUrl) to volume
        }

        if (dash.audio.isNullOrEmpty()) {
            throw IOException("AudioStreamError: 未找到有效的音频流数据")
        }

        val targetAudio = dash.audio.find { it.id == audioQuality }

        if (targetAudio != null) {
            return streamUrls(targetAudio.baseUrl, targetAudio.backupUrl) to volume
        } else {
            val highestQualityAudio = dash.audio[0]
            return streamUrls(highestQualityAudio.baseUrl, highestQualityAudio.backupUrl) to volume
        }
    }

    private fun streamUrls(primary: String, backups: List<String>?): List<String> {
        // Use only mirrors of the selected audio representation, preserving signed URLs verbatim.
        val urls = (listOf(primary) + backups.orEmpty()).filter { it.isNotBlank() }.distinct()
        if (urls.isEmpty()) throw IOException("AudioStreamError: 未找到有效的音频流地址")
        return urls
    }

    fun getFirstCid(bvid: String, cookie: String?): Long {
        val call = api.getPageList(cookie = cookie, bvid = bvid)
        val response = call.execute()

        if (!response.isSuccessful) {
            throw IOException("Bilibili API Http Error: ${response.code()}")
        }

        val apiResponse = response.body()
        if (apiResponse?.code != 0) {
            val msg = apiResponse?.message ?: "Unknown Error"
            throw IOException("Bilibili API Error: code=${apiResponse?.code} msg=$msg")
        }

        if (apiResponse.data == null) {
            throw IOException("Bilibili API Logic Error: code=0 msg=${apiResponse.message} but data is missing")
        }

        return apiResponse.data[0].cid
    }
}
