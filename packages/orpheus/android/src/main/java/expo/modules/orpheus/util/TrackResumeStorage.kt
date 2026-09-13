package expo.modules.orpheus.util

import android.content.Context
import android.util.Log
import com.tencent.mmkv.MMKV
import expo.modules.orpheus.model.TrackResumeRecord
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * 逐首断点续播存储。
 *
 * 与 [GeneralStorage] 中的会话快照分开管理，按稳定的音频 ID 保存最近一次实际播放位置。
 * 同一个音频在不同歌单中共享记录；Bilibili 不同分 P 通过 uniqueKey 自然区分。
 */
object TrackResumeStorage {
    const val STRATEGY_NONE = 0
    const val STRATEGY_PODCAST = 1

    private var kv: MMKV? = null
    private val json = Json { ignoreUnknownKeys = true }
    private const val KEY_STRATEGY = "config_resume_strategy"
    private const val KEY_RECORD_PREFIX = "resume::"

    @Synchronized
    fun initialize(context: Context) {
        if (kv == null) {
            MMKV.initialize(context)
            kv = MMKV.mmkvWithID("track_resume_store")
        }
    }

    private val safeKv: MMKV
        get() = kv ?: throw IllegalStateException("TrackResumeStorage not initialized")

    fun setStrategy(strategy: Int) {
        try {
            safeKv.encode(KEY_STRATEGY, strategy)
        } catch (e: Exception) {
            Log.e("TrackResumeStorage", "Failed to set resume strategy", e)
        }
    }

    fun getStrategy(): Int = kv?.decodeInt(KEY_STRATEGY, STRATEGY_NONE) ?: STRATEGY_NONE

    /**
     * 保存断点。无效位置（不再有意义的进度）不写入，避免覆盖已有有效记录。
     */
    fun save(id: String, position: Double, duration: Double) {
        if (id.isEmpty()) return
        if (!position.isFinite() || !duration.isFinite()) return
        if (position <= 0.0 || duration <= 0.0 || position >= duration) return

        try {
            val record = TrackResumeRecord(
                id = id,
                position = position,
                duration = duration,
                updatedAt = System.currentTimeMillis(),
            )
            safeKv.encode(KEY_RECORD_PREFIX + id, json.encodeToString(record))
        } catch (e: Exception) {
            Log.e("TrackResumeStorage", "Failed to save resume record for $id", e)
        }
    }

    fun get(id: String): TrackResumeRecord? {
        if (id.isEmpty()) return null
        return try {
            val raw = kv?.decodeString(KEY_RECORD_PREFIX + id) ?: return null
            val record = json.decodeFromString<TrackResumeRecord>(raw)
            if (record.position <= 0.0) return null
            if (!record.position.isFinite() || !record.duration.isFinite()) return null
            if (record.duration <= 0.0 || record.position >= record.duration) return null
            record
        } catch (e: Exception) {
            Log.e("TrackResumeStorage", "Failed to read resume record for $id", e)
            null
        }
    }

    fun clear(id: String) {
        if (id.isEmpty()) return
        try {
            kv?.removeValueForKey(KEY_RECORD_PREFIX + id)
        } catch (e: Exception) {
            Log.e("TrackResumeStorage", "Failed to clear resume record for $id", e)
        }
    }
}
