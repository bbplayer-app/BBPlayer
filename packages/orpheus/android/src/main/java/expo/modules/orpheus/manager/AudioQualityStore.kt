package expo.modules.orpheus.manager

import android.content.Context
import android.content.SharedPreferences
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.bilibili.BilibiliAudioQualityId
import expo.modules.orpheus.telemetry.LogTags
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

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

    private val preferences = setOf(PREF_LOW, PREF_STANDARD, PREF_HIGH, PREF_HIRES, PREF_DOLBY)
    private val infos = ConcurrentHashMap<String, AudioQualityInfo>()
    private val updatedAt = ConcurrentHashMap<String, Long>()
    private val listeners = CopyOnWriteArrayList<(String, AudioQualityInfo) -> Unit>()

    @Volatile
    private var prefs: SharedPreferences? = null

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

    fun preferenceForStreamId(id: Int): String? = when (id) {
        BilibiliAudioQualityId.LOW -> PREF_LOW
        BilibiliAudioQualityId.STANDARD -> PREF_STANDARD
        BilibiliAudioQualityId.HIGH -> PREF_HIGH
        else -> null
    }

    fun preferenceFromQuery(query: String?): String? {
        if (query.isNullOrBlank()) return null
        if (preferences.contains(query)) return query
        return query.toIntOrNull()?.let { preferenceForStreamId(it) }
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

    @Synchronized
    fun init(context: Context) {
        prefs = runCatching {
            context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }.getOrNull()
    }

    fun put(uri: String, info: AudioQualityInfo) {
        val key = cacheKeyOf(uri, info.preferredQuality)
        infos[key] = info
        updatedAt[key] = System.currentTimeMillis()
        enforceMemoryLimit()
        persist(key, info)
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

    fun get(uri: String, preferredQuality: String): AudioQualityInfo? {
        val key = cacheKeyOf(uri, preferredQuality)
        infos[key]?.let { return it }
        val restored = restore(key) ?: return null
        infos[key] = restored
        return restored
    }

    fun describeCachedQualityInfo(uri: String, preference: String): AudioQualityInfo? =
        get(uri, normalizePreference(preference))

    fun clearAll() {
        infos.clear()
        updatedAt.clear()
        runCatching { prefs?.edit()?.clear()?.apply() }
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
            bitrate >= 160_000 -> KIND_NORMAL to BilibiliAudioQualityId.HIGH
            bitrate >= 96_000 -> KIND_NORMAL to BilibiliAudioQualityId.STANDARD
            bitrate > 0 -> KIND_NORMAL to BilibiliAudioQualityId.LOW
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

    @Synchronized
    private fun persist(key: String, info: AudioQualityInfo) {
        val store = prefs ?: return
        runCatching {
            val entries = readEntries(store)
            entries.put(key, encode(info))
            trim(entries)
            store.edit().putString(PREFS_KEY_ENTRIES, entries.toString()).apply()
        }
    }

    @Synchronized
    private fun restore(key: String): AudioQualityInfo? {
        val store = prefs ?: return null
        return runCatching { readEntries(store).optJSONObject(key)?.let(::decode) }.getOrNull()
    }

    private fun readEntries(store: SharedPreferences): JSONObject = runCatching {
        JSONObject(store.getString(PREFS_KEY_ENTRIES, null) ?: "{}")
    }.getOrDefault(JSONObject())

    private fun encode(info: AudioQualityInfo): JSONObject = JSONObject().apply {
        put("updatedAt", System.currentTimeMillis())
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

    private fun trim(entries: JSONObject) {
        if (entries.length() <= MAX_PERSISTED_ENTRIES) return
        val stale = entries.keys().asSequence()
            .sortedBy { key -> entries.optJSONObject(key)?.optLong("updatedAt", 0L) ?: 0L }
            .take(entries.length() - MAX_PERSISTED_ENTRIES)
            .toList()
        stale.forEach { key ->
            entries.remove(key)
            infos.remove(key)
            updatedAt.remove(key)
        }
    }

    private fun enforceMemoryLimit() {
        val size = infos.size
        if (size <= MAX_PERSISTED_ENTRIES * 2) return
        val staleCount = size - MAX_PERSISTED_ENTRIES / 2
        infos.keys
            .sortedBy { key -> updatedAt[key] ?: 0L }
            .take(staleCount)
            .forEach { key ->
                infos.remove(key)
                updatedAt.remove(key)
            }
    }

    fun addListener(listener: (String, AudioQualityInfo) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (String, AudioQualityInfo) -> Unit) {
        listeners.remove(listener)
    }
}
