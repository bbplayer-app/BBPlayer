package expo.modules.orpheus.utils

import android.content.Context
import android.util.Log
import com.tencent.mmkv.MMKV

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
            Log.d("LoudnessNormalization", "setLoudnessData: $key, $measuredI")
            safeKv.encode(key, measuredI)
        } catch (e: Exception) {
            Log.e("LoudnessStorage", "Failed to set loudness data", e)
        }
    }

    fun getLoudnessData(key: String): Double {
        try {
            Log.d("LoudnessNormalization", "getLoudnessData: $key")
            return safeKv.decodeDouble(key)
        } catch (e: Exception) {
            Log.e("LoudnessStorage", "Failed to get loudness data", e)
            return 0.0
        }
    }
}