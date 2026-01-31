package expo.modules.orpheus.network

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object OkHttpClientManager {
    val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }
}
