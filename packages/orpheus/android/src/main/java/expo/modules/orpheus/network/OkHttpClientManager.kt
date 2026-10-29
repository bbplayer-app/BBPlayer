package expo.modules.orpheus.network

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object OkHttpClientManager {
    val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val request = chain.request()
                val host = request.url.host
                val isBilibiliMedia = host.endsWith(".bilivideo.com") ||
                    host.endsWith(".bilivideo.cn")

                // Media3 already sets precise ranges for seeking and resumed downloads.
                // Initial unbounded requests also need a Range header on some Bilibili CDNs.
                val mediaRequest = if (isBilibiliMedia && request.header("Range") == null) {
                    request.newBuilder().header("Range", "bytes=0-").build()
                } else {
                    request
                }
                chain.proceed(mediaRequest)
            }
            .build()
    }
}
