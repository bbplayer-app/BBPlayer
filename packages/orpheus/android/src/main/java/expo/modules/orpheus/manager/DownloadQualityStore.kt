package expo.modules.orpheus.manager

import android.content.Context
import android.content.SharedPreferences
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.LogTags
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * 下载时实际拿到的音轨，按下载缓存 key 存。
 *
 * 和 [AudioQualityStore] 分开：那边是播放记录，有条数上限会淘汰旧的；
 * 下载记录要跟着下载一直留着，删除下载时才删。每条单独一个 key，写一条不用重写整份。
 */
object DownloadQualityStore {
    private const val PREFS_NAME = "orpheus_download_quality"

    private val infos = ConcurrentHashMap<String, AudioQualityInfo>()

    @Volatile
    private var prefs: SharedPreferences? = null

    /** 模块和服务都会调用，只有第一次生效 */
    @Synchronized
    fun init(context: Context) {
        if (prefs != null) return
        val store = runCatching {
            context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }.getOrNull() ?: return
        prefs = store
        runCatching {
            store.all.forEach { (key, value) ->
                val info = (value as? String)?.let { decode(it) } ?: return@forEach
                // init 之前写入的更新，不能被旧数据覆盖
                infos.putIfAbsent(key, info)
            }
        }.onFailure { error ->
            NativeLog.warning(LogTags.STORAGE, "storage.download_quality.restore_failed", error = error)
        }
    }

    fun put(downloadKey: String, info: AudioQualityInfo) {
        val stored = info.copy(isFromDownloadCache = true)
        infos[downloadKey] = stored
        prefs?.edit()?.putString(downloadKey, encode(stored))?.apply()
    }

    fun get(downloadKey: String): AudioQualityInfo? = infos[downloadKey]

    fun remove(downloadKey: String) {
        infos.remove(downloadKey)
        prefs?.edit()?.remove(downloadKey)?.apply()
    }

    private fun encode(info: AudioQualityInfo): String = JSONObject().apply {
        put("preferredQuality", info.preferredQuality)
        put("actualKind", info.actualKind)
        put("actualStreamId", info.actualStreamId ?: JSONObject.NULL)
        put("codecs", info.codecs ?: JSONObject.NULL)
        put("bandwidth", info.bandwidth ?: JSONObject.NULL)
        put("isFallback", info.isFallback)
        put("availableQualities", JSONArray(info.availableQualities))
    }.toString()

    private fun decode(json: String): AudioQualityInfo? = runCatching {
        val raw = JSONObject(json)
        AudioQualityInfo(
            preferredQuality = raw.getString("preferredQuality"),
            actualKind = raw.getString("actualKind"),
            actualStreamId = if (raw.isNull("actualStreamId")) null else raw.getInt("actualStreamId"),
            codecs = if (raw.isNull("codecs")) null else raw.getString("codecs"),
            bandwidth = if (raw.isNull("bandwidth")) null else raw.getLong("bandwidth"),
            isFallback = raw.optBoolean("isFallback", false),
            isFromDownloadCache = true,
            availableQualities = raw.optJSONArray("availableQualities")?.let { array ->
                (0 until array.length()).mapNotNull { index -> array.optString(index).takeIf { it.isNotBlank() } }
            }.orEmpty(),
        )
    }.getOrNull()
}
