package expo.modules.orpheus.util

import expo.modules.bbplayernative.telemetry.NativeLog

import android.content.Context
import com.tencent.mmkv.MMKV
import expo.modules.orpheus.telemetry.LogTags

object LoudnessStorage {
    private var kv: MMKV? = null


    @Synchronized
    fun initialize(context: Context) {
        if (kv == null) {
            MMKV.initialize(context)
            kv = MMKV.mmkvWithID("loudness_normalization_store")
        }
    }

    private val safeKv: MMKV
        get() = kv ?: throw IllegalStateException("LoudnessStorage not initialized")

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

    fun exportAll(): Map<String, Double> {
        val keys = kv?.allKeys() ?: return emptyMap()
        return keys.associate { it to getLoudnessData(it) }
    }

    fun importAll(data: Map<String, Double>) {
        data.forEach { (key, value) -> setLoudnessData(key, value) }
    }
}