package expo.modules.orpheus.manager

import android.content.Context
import android.content.SharedPreferences
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.bilibili.BilibiliAudioQualityId
import expo.modules.orpheus.telemetry.LogTags
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

data class AudioQualityInfo(
    val preferredQuality: String,
    val actualKind: String,
    val actualStreamId: Int?,
    val codecs: String?,
    val bandwidth: Long?,
    val isFallback: Boolean,
    val isFromDownloadCache: Boolean,
    val availableQualities: List<String> = emptyList(),
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "preferredQuality" to preferredQuality,
        "actualKind" to actualKind,
        "actualStreamId" to actualStreamId,
        "codecs" to codecs,
        "bandwidth" to bandwidth,
        "isFallback" to isFallback,
        "isFromDownloadCache" to isFromDownloadCache,
        "availableQualities" to availableQualities,
    )
}

data class AudioQualityRequest(
    val preference: String,
    val audioQuality: Int,
    val enableDolby: Boolean,
    val enableHiRes: Boolean,
)

object AudioQualityStore {
    const val PREF_LOW = "low"
    const val PREF_STANDARD = "standard"
    const val PREF_HIGH = "high"
    const val PREF_HIRES = "hires"
    const val PREF_DOLBY = "dolby"

    const val KIND_DOLBY = "dolby"
    const val KIND_HIRES = "hires"
    const val KIND_NORMAL = "normal"
    const val KIND_DURL = "durl"
    const val KIND_LOCAL = "local"
    const val KIND_UNKNOWN = "unknown"

    private const val PREFS_NAME = "orpheus_audio_quality_meta"
    private const val PREFS_KEY_ENTRIES = "entries"
    private const val MAX_PERSISTED_ENTRIES = 500
    private const val HIRES_STREAM_ID = 30251
    private const val DOLBY_STREAM_ID = 30250

    private val DOLBY_CODEC_TOKENS = listOf("ec-3", "ac-3", "eac3", "ac-4", "mlpa")

    val ALL_PREFERENCES = listOf(PREF_LOW, PREF_STANDARD, PREF_HIGH, PREF_HIRES, PREF_DOLBY)
    private val preferences = ALL_PREFERENCES.toSet()

    /** 全部记录常驻内存，按写入时间排序（最旧在前），init 时从 SharedPreferences 读一次 */
    private val infos = LinkedHashMap<String, AudioQualityInfo>()
    private val updatedAts = HashMap<String, Long>()
    private val persistExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "orpheus-audio-quality-store").apply { isDaemon = true }
    }
    private val persistScheduled = AtomicBoolean(false)
    private val listeners = CopyOnWriteArrayList<(String, AudioQualityInfo) -> Unit>()

    @Volatile
    private var prefs: SharedPreferences? = null

    private data class Entry(val info: AudioQualityInfo, val updatedAt: Long)

    fun normalizePreference(value: String?): String {
        return if (value != null && preferences.contains(value)) value else PREF_HIGH
    }

    fun requestFor(preference: String): AudioQualityRequest {
        return when (normalizePreference(preference)) {
            PREF_LOW -> AudioQualityRequest(PREF_LOW, BilibiliAudioQualityId.LOW, false, false)
            PREF_STANDARD -> AudioQualityRequest(PREF_STANDARD, BilibiliAudioQualityId.STANDARD, false, false)
            PREF_HIRES -> AudioQualityRequest(PREF_HIRES, BilibiliAudioQualityId.HIGH, false, true)
            PREF_DOLBY -> AudioQualityRequest(PREF_DOLBY, BilibiliAudioQualityId.HIGH, true, true)
            else -> AudioQualityRequest(PREF_HIGH, BilibiliAudioQualityId.HIGH, false, false)
        }
    }

    fun isFallback(preferred: String, actualKind: String, actualStreamId: Int?): Boolean {
        val preference = normalizePreference(preferred)
        if (preference == PREF_DOLBY) return actualKind != KIND_DOLBY
        if (preference == PREF_HIRES) return actualKind != KIND_HIRES
        if (actualKind == KIND_DOLBY || actualKind == KIND_HIRES) return false
        if (actualKind != KIND_NORMAL) return true
        return (actualStreamId ?: 0) < requestFor(preference).audioQuality
    }

    fun cacheKeyOf(uri: String, preferredQuality: String): String = "$uri|q=${normalizePreference(preferredQuality)}"

    /** 模块和服务都会调用，只有第一次生效 */
    @Synchronized
    fun init(context: Context) {
        if (prefs != null) return
        val store = runCatching {
            context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }.getOrNull() ?: return
        prefs = store
        runCatching {
            val entries = JSONObject(store.getString(PREFS_KEY_ENTRIES, null) ?: "{}")
            val restored = entries.keys().asSequence()
                .mapNotNull { key -> entries.optJSONObject(key)?.let { raw -> Triple(key, raw.optLong("updatedAt", 0L), raw) } }
                .sortedBy { it.second }
                .mapNotNull { (key, updatedAt, raw) -> decode(raw)?.let { key to Entry(it, updatedAt) } }
                .toList()
            // 内存里已有的（init 之前写入的）更新，不能被旧数据覆盖
            val pending = LinkedHashMap(infos)
            val pendingUpdatedAts = HashMap(updatedAts)
            infos.clear()
            restored.forEach { (key, entry) ->
                infos[key] = entry.info
                updatedAts[key] = entry.updatedAt
            }
            pending.forEach { (key, info) ->
                infos.remove(key)
                infos[key] = info
                updatedAts[key] = pendingUpdatedAts[key] ?: System.currentTimeMillis()
            }
            if (pending.isNotEmpty()) schedulePersist()
        }.onFailure { error ->
            NativeLog.warning(LogTags.STORAGE, "storage.audio_quality.restore_failed", error = error)
        }
    }

    fun put(uri: String, info: AudioQualityInfo) {
        val key = cacheKeyOf(uri, info.preferredQuality)
        synchronized(this) {
            infos.remove(key)
            infos[key] = info
            updatedAts[key] = System.currentTimeMillis()
            while (infos.size > MAX_PERSISTED_ENTRIES) {
                val eldest = infos.keys.first()
                infos.remove(eldest)
                updatedAts.remove(eldest)
            }
        }
        schedulePersist()
        NativeLog.info(
            LogTags.STORAGE,
            "audio.quality.resolved",
            mapOf(
                "audio.preferred_quality" to info.preferredQuality,
                "audio.actual_kind" to info.actualKind,
                "audio.actual_stream_id" to info.actualStreamId,
                "audio.is_fallback" to info.isFallback,
            ),
        )
        listeners.forEach { listener ->
            runCatching { listener(uri, info) }
                .onFailure { error ->
                    NativeLog.warning(LogTags.STORAGE, "storage.audio_quality.listener_failed", error = error)
                }
        }
    }

    @Synchronized
    fun get(uri: String, preferredQuality: String): AudioQualityInfo? = infos[cacheKeyOf(uri, preferredQuality)]

    /** 清空记录，[keepUri] 这首（通常是正在播放的歌）各档的记录保留，否则它会变成「未确认」 */
    fun clearAll(keepUris: Set<String> = emptySet()) {
        val keep = keepUris.flatMap { uri -> ALL_PREFERENCES.map { cacheKeyOf(uri, it) } }.toSet()
        synchronized(this) {
            infos.keys.retainAll(keep)
            updatedAts.keys.retainAll(keep)
        }
        schedulePersist()
    }

    fun inferFromAudioFormat(
        preferredQuality: String,
        sampleMimeType: String?,
        codecs: String?,
        bitrate: Int,
    ): AudioQualityInfo? {
        val preference = normalizePreference(preferredQuality)
        val probe = listOfNotNull(sampleMimeType, codecs).joinToString(" ").lowercase(Locale.ROOT)
        val (actualKind, actualStreamId) = when {
            probe.contains("flac") -> KIND_HIRES to HIRES_STREAM_ID
            DOLBY_CODEC_TOKENS.any { token -> probe.contains(token) } -> KIND_DOLBY to DOLBY_STREAM_ID
            else -> return null
        }
        return AudioQualityInfo(
            preferredQuality = preference,
            actualKind = actualKind,
            actualStreamId = actualStreamId,
            codecs = codecs?.takeIf { it.isNotBlank() } ?: sampleMimeType,
            bandwidth = bitrate.takeIf { it > 0 }?.toLong(),
            isFallback = isFallback(preference, actualKind, actualStreamId),
            isFromDownloadCache = false,
            availableQualities = emptyList(),
        )
    }

    /** 合并短时间内的多次写入，在后台线程把整份快照写回 */
    private fun schedulePersist() {
        if (prefs == null) return
        if (!persistScheduled.compareAndSet(false, true)) return
        persistExecutor.execute {
            persistScheduled.set(false)
            val store = prefs ?: return@execute
            runCatching {
                val snapshot = JSONObject()
                synchronized(this) {
                    infos.forEach { (key, info) ->
                        snapshot.put(key, encode(info, updatedAts[key] ?: 0L))
                    }
                }
                store.edit().putString(PREFS_KEY_ENTRIES, snapshot.toString()).apply()
            }.onFailure { error ->
                NativeLog.warning(LogTags.STORAGE, "storage.audio_quality.persist_failed", error = error)
            }
        }
    }

    private fun encode(info: AudioQualityInfo, updatedAt: Long): JSONObject = JSONObject().apply {
        put("updatedAt", updatedAt)
        put("preferredQuality", info.preferredQuality)
        put("actualKind", info.actualKind)
        put("actualStreamId", info.actualStreamId ?: JSONObject.NULL)
        put("codecs", info.codecs ?: JSONObject.NULL)
        put("bandwidth", info.bandwidth ?: JSONObject.NULL)
        put("isFallback", info.isFallback)
        put("isFromDownloadCache", info.isFromDownloadCache)
        put("availableQualities", JSONArray(info.availableQualities))
    }

    private fun decode(raw: JSONObject): AudioQualityInfo? = runCatching {
        AudioQualityInfo(
            preferredQuality = raw.getString("preferredQuality"),
            actualKind = raw.getString("actualKind"),
            actualStreamId = if (raw.isNull("actualStreamId")) null else raw.getInt("actualStreamId"),
            codecs = if (raw.isNull("codecs")) null else raw.getString("codecs"),
            bandwidth = if (raw.isNull("bandwidth")) null else raw.getLong("bandwidth"),
            isFallback = raw.optBoolean("isFallback", false),
            isFromDownloadCache = raw.optBoolean("isFromDownloadCache", false),
            availableQualities = raw.optJSONArray("availableQualities")?.let { array ->
                (0 until array.length()).mapNotNull { index -> array.optString(index).takeIf { it.isNotBlank() } }
            }.orEmpty(),
        )
    }.getOrNull()

    fun addListener(listener: (String, AudioQualityInfo) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (String, AudioQualityInfo) -> Unit) {
        listeners.remove(listener)
    }
}
