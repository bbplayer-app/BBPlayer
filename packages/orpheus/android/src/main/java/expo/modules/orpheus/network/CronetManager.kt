package expo.modules.orpheus.network

import android.content.Context
import org.chromium.net.CronetEngine

object CronetManager {
    var cronetEngine: CronetEngine? = null

    fun init(context: Context) {
        if (cronetEngine != null) return
        try {
            cronetEngine = CronetEngine.Builder(context)
                .enableHttp2(true)
                .enableQuic(true)
                .enableHttpCache(CronetEngine.Builder.HTTP_CACHE_DISABLED, 0)
                .build()
        } catch (_: Exception) {
        }
    }
}
