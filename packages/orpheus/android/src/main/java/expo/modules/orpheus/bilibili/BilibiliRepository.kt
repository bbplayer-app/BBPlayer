package expo.modules.orpheus.bilibili

import expo.modules.bbplayernative.telemetry.NativeLog

import android.net.Uri
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.orpheus.util.GeneralStorage

import io.sentry.ISpan
import io.sentry.Sentry
import io.sentry.SpanStatus
import io.sentry.TransactionContext
import io.sentry.TransactionOptions
import retrofit2.Call
import retrofit2.Response
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
    val availableQualities: List<String> = emptyList(),
)

object BilibiliRepository {

    private val api: BilibiliApi by lazy {
        NetworkModule.retrofit.create(BilibiliApi::class.java)
    }

    private var cachedImgKey: String? = null
    private var cachedSubKey: String? = null
    private var cachedDateStr: String? = null

    private fun <T> traceStep(parent: ISpan?, name: String, block: (ISpan?) -> T): T {
        val span = parent?.startChild("playback", name)
        var status = SpanStatus.INTERNAL_ERROR
        try {
            val result = block(span)
            status = SpanStatus.OK
            return result
        } finally {
            span?.finish(status)
        }
    }

    /**
     * 执行请求并记录一个 http.client span。span 名与属性和 JS 侧 ApiClient 保持一致
     * （error.type 取 RequestFailed / ResponseFailed），在 Sentry 里能和 JS 的请求一起按接口聚合、告警；
     * 用 bbplayer.source 区分来源。失败时另打一条结构化日志，方便看错误信息。
     * 原生 tracing 依赖 Sentry SDK 的内部行为，升级 Sentry 时按 docs/Native-Tracing.md 检查。
     *
     * @param codeOf 取出响应体里的业务码；不传表示业务码非 0 也不算失败（如未登录时 nav 返回 -101）
     * @param parent 所属的起播 span；为空时请求自己成为一个 transaction
     */
    private fun <T> execute(parent: ISpan?, createCall: () -> Call<T>, codeOf: ((T) -> Int)? = null): Response<T> {
        // Retrofit/转换器首次初始化和请求构造发生在 call.execute 之前，不能落在 HTTP span 外的空白里。
        val call = traceStep(parent, "playback.api.prepare") {
            createCall().also { it.request() }
        }
        val request = call.request()
        val url = request.url
        val fields = mutableMapOf<String, Any?>(
            "http.request.method" to request.method,
            "server.address" to url.host,
            "url.path" to url.encodedPath,
            "bbplayer.source" to "native",
        )
        val name = "${request.method} ${url.scheme}://${url.host}${url.encodedPath}"
        // 不绑定到 scope：播放器线程上并发的请求各自独立成 trace
        val span = parent?.startChild("http.client", name) ?: Sentry.startTransaction(
            TransactionContext(name, "http.client"),
            TransactionOptions().apply { isBindToScope = false },
        )

        fun finish(errorType: String?, error: Throwable? = null) {
            fields.forEach { (key, value) -> if (value != null) span.setData(key, value) }
            if (errorType == null) {
                span.finish(SpanStatus.OK)
                return
            }
            fields["error.type"] = errorType
            fields["error.message"] = error?.message
            span.setData("error.type", errorType)
            span.throwable = error
            span.finish(SpanStatus.INTERNAL_ERROR)
            NativeLog.warning(LogTags.STREAM, "bilibili.api.request_failed", fields)
        }

        val response = try {
            call.execute()
        } catch (e: Exception) {
            // IOException 是网络层失败；其他异常来自 JSON 反序列化
            finish(if (e is IOException) "RequestFailed" else "ResponseFailed", e)
            throw e
        }

        fields["http.response.status_code"] = response.code()
        val code = response.body()?.let { body -> codeOf?.invoke(body) }
        fields["bilibili.code"] = code

        finish(
            when {
                !response.isSuccessful -> "RequestFailed"
                codeOf != null && code != 0 -> "ResponseFailed"
                else -> null
            },
        )
        return response
    }

    private fun getTodayDateStr(): String {
        val sdf = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return sdf.format(Date())
    }

    @Synchronized
    private fun getWbiKeys(parent: ISpan?): Pair<String, String> {
        val today = getTodayDateStr()

        if (cachedImgKey != null && cachedSubKey != null && today == cachedDateStr) {
            return cachedImgKey!! to cachedSubKey!!
        }
        NativeLog.info(LogTags.STREAM, "bilibili.wbi.refresh_started")

        val response = execute(parent, { api.getNavInfo() })
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
        cookie: String?,
        parent: ISpan? = null,
    ): ResolvedAudio {
        var cidInternal = cid
        val (imgKey, subKey) = traceStep(parent, "playback.wbi_keys") { getWbiKeys(it) }
        if (cidInternal === null) {
            cidInternal = getFirstCid(bvid, cookie, parent)
        }

        NativeLog.info(
            LogTags.STREAM,
            "bilibili.stream.resolve_started",
            mapOf(
                "bilibili.bvid" to bvid,
                "bilibili.cid" to cidInternal,
                "stream.requested_quality" to audioQuality,
                "stream.hires_enabled" to enableHiRes,
                "stream.dolby_enabled" to enableDolby,
            ),
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

        val signedParams = traceStep(parent, "playback.wbi_sign") { WbiUtil.sign(rawParams, imgKey, subKey) }

        val response = execute(parent, { api.getPlayUrl(cookie, signedParams) }) { it.code }

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
            NativeLog.info(
                LogTags.STREAM,
                "bilibili.stream.selected",
                mapOf(
                    "bilibili.bvid" to bvid,
                    "stream.kind" to "durl",
                ),
            )
            return ResolvedAudio(streamUrls(durl[0].url, durl[0].backupUrl), volume, "durl", null, null, null)
        }

        val availableQualities = collectAvailableQualities(dash)

        if (enableDolby && dash.dolby?.audio?.isNotEmpty() == true) {
            return selected(bvid, "dolby", dash.dolby.audio[0], volume, availableQualities)
        }

        if (enableHiRes && dash.flac?.audio != null) {
            return selected(bvid, "hires", dash.flac.audio, volume, availableQualities)
        }

        if (dash.audio.isNullOrEmpty()) {
            throw IOException("AudioStreamError: 未找到有效的音频流数据")
        }

        val targetAudio = dash.audio.find { it.id == audioQuality }
        if (targetAudio == null) {
            NativeLog.warning(
                LogTags.STREAM,
                "bilibili.stream.quality_unavailable",
                mapOf(
                    "bilibili.bvid" to bvid,
                    "stream.requested_quality" to audioQuality,
                    "stream.available_qualities" to dash.audio.joinToString { it.id.toString() },
                ),
            )
        }
        return selected(
            bvid,
            "normal",
            targetAudio ?: selectClosestAudio(dash.audio, audioQuality),
            volume,
            availableQualities,
        )
    }

    private fun collectAvailableQualities(dash: DashData): List<String> {
        val audioIds = dash.audio.orEmpty().mapTo(mutableSetOf()) { it.id }
        val qualities = mutableListOf<String>()
        if (audioIds.contains(BilibiliAudioQualityId.LOW)) qualities += "low"
        if (audioIds.contains(BilibiliAudioQualityId.STANDARD)) qualities += "standard"
        if (audioIds.contains(BilibiliAudioQualityId.HIGH)) qualities += "high"
        if (dash.flac?.audio != null) qualities += "hires"
        if (dash.dolby?.audio?.isNotEmpty() == true) qualities += "dolby"
        return qualities
    }

    private fun selectClosestAudio(streams: List<DashAudioItem>, audioQuality: Int): DashAudioItem {
        return streams.filter { it.id <= audioQuality }.maxByOrNull { it.id }
            ?: streams.minByOrNull { it.id }
            ?: throw IOException("AudioStreamError: 未找到有效的音频流数据")
    }

    private fun selected(
        bvid: String,
        kind: String,
        audio: DashAudioItem,
        volume: VolumeData?,
        availableQualities: List<String>,
    ): ResolvedAudio {
        val urls = streamUrls(audio.baseUrl, audio.backupUrl)
        NativeLog.info(
            LogTags.STREAM,
            "bilibili.stream.selected",
            mapOf(
                "bilibili.bvid" to bvid,
                "stream.kind" to kind,
                "stream.quality" to audio.id,
                "audio.codecs" to audio.codecs,
                "stream.bandwidth_bps" to audio.bandwidth,
                "stream.hosts" to urls.joinToString { Uri.parse(it).host.orEmpty() },
            ),
        )
        return ResolvedAudio(urls, volume, kind, audio.id, audio.codecs, audio.bandwidth, availableQualities)
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

    fun getFirstCid(bvid: String, cookie: String?, parent: ISpan? = null): Long {
        val response = execute(parent, { api.getPageList(cookie = cookie, bvid = bvid) }) { it.code }

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
