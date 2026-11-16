package expo.modules.orpheus.bilibili

import android.util.Log
import android.net.Uri
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.orpheus.util.GeneralStorage

import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 解析出的音频流：同一音轨的所有镜像地址，以及选中的是哪一种流（用于日志和 Sentry context） */
data class ResolvedAudio(
    val urls: List<String>,
    val volume: VolumeData?,
    /** dolby / hires / normal / durl */
    val kind: String,
    val streamId: Int?,
    val codecs: String?,
    val bandwidth: Long?,
)

object BilibiliRepository {

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
        Log.i(LogTags.STREAM, "refreshWbiKeys")

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
    ): ResolvedAudio {
        var cidInternal = cid
        val (imgKey, subKey) = getWbiKeys()
        if (cidInternal === null) {
            cidInternal = getFirstCid(bvid, cookie)
        }

        Log.i(
            LogTags.STREAM,
            "resolveAudio bvid=$bvid cid=$cidInternal quality=$audioQuality hires=$enableHiRes dolby=$enableDolby",
        )

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
            Log.i(LogTags.STREAM, "selectStream bvid=$bvid kind=durl")
            return ResolvedAudio(streamUrls(durl[0].url, durl[0].backupUrl), volume, "durl", null, null, null)
        }

        if (enableDolby && dash.dolby?.audio?.isNotEmpty() == true) {
            return selected(bvid, "dolby", dash.dolby.audio[0], volume)
        }

        if (enableHiRes && dash.flac?.audio != null) {
            return selected(bvid, "hires", dash.flac.audio, volume)
        }

        if (dash.audio.isNullOrEmpty()) {
            throw IOException("AudioStreamError: 未找到有效的音频流数据")
        }

        val targetAudio = dash.audio.find { it.id == audioQuality }
        if (targetAudio == null) {
            Log.w(
                LogTags.STREAM,
                "requestedQualityUnavailable bvid=$bvid quality=$audioQuality available=${dash.audio.map { it.id }}",
            )
        }
        return selected(bvid, "normal", targetAudio ?: dash.audio[0], volume)
    }

    private fun selected(bvid: String, kind: String, audio: DashAudioItem, volume: VolumeData?): ResolvedAudio {
        val urls = streamUrls(audio.baseUrl, audio.backupUrl)
        Log.i(
            LogTags.STREAM,
            "selectStream bvid=$bvid kind=$kind id=${audio.id} codecs=${audio.codecs} " +
                "bandwidth=${audio.bandwidth} hosts=${urls.map { Uri.parse(it).host }}",
        )
        return ResolvedAudio(urls, volume, kind, audio.id, audio.codecs, audio.bandwidth)
    }

    private fun streamUrls(primary: String, backups: List<String>?): List<String> {
        // Use only mirrors of the selected audio representation, preserving signed URLs verbatim.
        val urls = (listOf(primary) + backups.orEmpty()).filter { it.isNotBlank() }.distinct()
        if (urls.isEmpty()) throw IOException("AudioStreamError: 未找到有效的音频流地址")
        val (mcdn, regular) = urls.partition(::isMcdnUrl)
        val preference = GeneralStorage.getPreferredBilibiliCdn()
        if (preference == "auto") return regular + mcdn
        val (preferred, remaining) = regular.partition { url ->
            val host = Uri.parse(url).host.orEmpty().lowercase(Locale.ROOT)
            when (preference) {
                "akamai" -> host == "upos-hz-mirrorakam.akamaized.net"
                "ali" -> host.endsWith(".bilivideo.com") && host.startsWith("upos-sz-mirrorali")
                "tencent" -> host.endsWith(".bilivideo.com") &&
                    (host.startsWith("upos-sz-mirrorcos") || host == "upos-tf-all-tx.bilivideo.com")
                "huawei" -> host.endsWith(".bilivideo.com") &&
                    (host.startsWith("upos-sz-mirrorhw") || host.startsWith("upos-sz-mirror08") || host == "upos-tf-all-hw.bilivideo.com")
                else -> false
            }
        }
        return preferred + remaining + mcdn
    }

    private fun isMcdnUrl(url: String): Boolean {
        val uri = Uri.parse(url)
        val host = uri.host.orEmpty().lowercase(Locale.ROOT)
        // Some normal-looking mirror URLs are also mcdn, as indicated by os=mcdn.
        return uri.getQueryParameter("os") == "mcdn" ||
            Regex("""(^|\.)mcdn\.bilivideo\.(com|cn|net)$""").containsMatchIn(host) ||
            (Regex("""(?:\d{1,3}\.){3}\d{1,3}""").matches(host) &&
                Regex("""/v\d+/resource(?:/.*)?""").matches(uri.path.orEmpty()))
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
