package expo.modules.orpheus.util

import expo.modules.bbplayernative.telemetry.NativeLog

import android.content.Context
import com.tencent.mmkv.MMKV
import expo.modules.orpheus.telemetry.LogTags

object LoudnessStorage {
    private var kv: MMKV? = null

    // 真峰值单独存一个 store：原 store 的所有键都是响度，备份格式依赖这一点
    private var truePeakKv: MMKV? = null

    @Synchronized
    fun initialize(context: Context) {
        if (kv == null) {
            MMKV.initialize(context)
            kv = MMKV.mmkvWithID("loudness_normalization_store")
            truePeakKv = MMKV.mmkvWithID("loudness_true_peak_store")
        }
    }

    private val safeKv: MMKV
        get() = kv ?: throw IllegalStateException("LoudnessStorage not initialized")

    private val safeTruePeakKv: MMKV
        get() = truePeakKv ?: throw IllegalStateException("LoudnessStorage not initialized")

    fun setLoudnessData(key: String, measuredI: Double) {
        try {
            NativeLog.debug(
                LogTags.LOUDNESS,
                "audio.loudness.stored",
                mapOf(
                    "track.id" to key,
                    "audio.integrated_loudness_lufs" to measuredI,
                ),
            )
            safeKv.encode(key, measuredI)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.loudness.write_failed", error = e)
        }
    }

    fun getLoudnessData(key: String): Double {
        try {
            NativeLog.debug(LogTags.LOUDNESS, "audio.loudness.read_started", mapOf("track.id" to key))
            return safeKv.decodeDouble(key)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.loudness.read_failed", error = e)
            return 0.0
        }
    }

    fun setTruePeak(key: String, measuredTp: Double) {
        try {
            safeTruePeakKv.encode(key, measuredTp)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.loudness.write_failed", error = e)
        }
    }

    /** 没有记录时返回 null。0 dBTP 是合法值，不能拿 0 当“没有” */
    fun getTruePeak(key: String): Double? {
        try {
            val kv = safeTruePeakKv
            if (!kv.containsKey(key)) return null
            return kv.decodeDouble(key)
        } catch (e: Exception) {
            NativeLog.error(LogTags.STORAGE, "storage.loudness.read_failed", error = e)
            return null
        }
    }

    fun exportAll(): Map<String, Double> {
        val keys = kv?.allKeys() ?: return emptyMap()
        return keys.associate { it to getLoudnessData(it) }
    }

    fun exportTruePeaks(): Map<String, Double> {
        val kv = truePeakKv ?: return emptyMap()
        val keys = kv.allKeys() ?: return emptyMap()
        return keys.associateWith { kv.decodeDouble(it) }
    }

    fun importAll(data: Map<String, Double>) {
        data.forEach { (key, value) -> setLoudnessData(key, value) }
    }
}
