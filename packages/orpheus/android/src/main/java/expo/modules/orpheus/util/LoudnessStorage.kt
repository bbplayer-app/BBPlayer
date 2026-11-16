package expo.modules.orpheus.util

import android.content.Context
import android.util.Log
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
            Log.d(LogTags.LOUDNESS, "setLoudnessData: $key, $measuredI")
            safeKv.encode(key, measuredI)
        } catch (e: Exception) {
            Log.e(LogTags.STORAGE, "Failed to set loudness data", e)
        }
    }

    fun getLoudnessData(key: String): Double {
        try {
            Log.d(LogTags.LOUDNESS, "getLoudnessData: $key")
            return safeKv.decodeDouble(key)
        } catch (e: Exception) {
            Log.e(LogTags.STORAGE, "Failed to get loudness data", e)
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