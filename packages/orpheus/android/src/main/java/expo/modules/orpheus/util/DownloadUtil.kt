package expo.modules.orpheus.util

import android.content.Context
import android.util.Log
import androidx.core.net.toUri
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.scheduler.Requirements
import expo.modules.orpheus.OrpheusConfig
import expo.modules.orpheus.bilibili.BilibiliRepository
import expo.modules.orpheus.manager.DownloadCache
import expo.modules.orpheus.network.BilibiliFallbackDataSource
import expo.modules.orpheus.network.BilibiliStreamUrls
import expo.modules.orpheus.service.OrpheusDownloadService
import io.sentry.Sentry
import io.sentry.SpanStatus
import io.sentry.TracesSamplingDecision
import io.sentry.TransactionContext
import java.io.IOException
import java.util.concurrent.Executors

@UnstableApi
object DownloadUtil {
    private const val DEFAULT_MAX_PARALLEL_DOWNLOADS = 1
    private const val MIN_MAX_PARALLEL_DOWNLOADS = 1
    private const val MAX_MAX_PARALLEL_DOWNLOADS = 6

    private var downloadManager: DownloadManager? = null
    private var maxParallelDownloads = DEFAULT_MAX_PARALLEL_DOWNLOADS

    private var playerDataSourceFactory: DataSource.Factory? = null
    private var downloadDataSourceFactory: DataSource.Factory? = null

    private var downloadNotificationHelper: DownloadNotificationHelper? = null

    @Synchronized
    fun getDownloadManager(context: Context): DownloadManager {
        if (downloadManager == null) {
            val databaseProvider = StandaloneDatabaseProvider(context)
            downloadManager = DownloadManager(
                context,
                databaseProvider,
                DownloadCache.getStableCache(context),
                getDownloadDataSourceFactory(),
                Executors.newFixedThreadPool(6)
            ).apply {
                maxParallelDownloads = this@DownloadUtil.maxParallelDownloads
                requirements = Requirements(0)
            }
        }
        return downloadManager!!
    }

    @Synchronized
    fun setMaxParallelDownloads(context: Context, value: Int) {
        maxParallelDownloads = value.coerceIn(
            MIN_MAX_PARALLEL_DOWNLOADS,
            MAX_MAX_PARALLEL_DOWNLOADS
        )
        getDownloadManager(context).maxParallelDownloads = maxParallelDownloads
    }

    @Synchronized
    fun getPlayerDataSourceFactory(context: Context): DataSource.Factory {
        if (playerDataSourceFactory == null) {
            val upstreamFactory = getUpstreamFactory()

            val downloadCache = DownloadCache.getStableCache(context)
            val lruCache = DownloadCache.getLruCache(context)

            val cacheFactory = CacheDataSource.Factory()
                .setCache(lruCache)
                .setUpstreamDataSourceFactory(upstreamFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

            val downloadFactory = CacheDataSource.Factory()
                .setCache(downloadCache)
                .setUpstreamDataSourceFactory(cacheFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                .setCacheWriteDataSinkFactory(null)

            playerDataSourceFactory = downloadFactory
        }
        return playerDataSourceFactory!!
    }


    @Synchronized
    private fun getDownloadDataSourceFactory(): DataSource.Factory {
        if (downloadDataSourceFactory == null) {
            downloadDataSourceFactory = getUpstreamFactory()
        }
        return downloadDataSourceFactory!!
    }

    private fun getUpstreamFactory(): DataSource.Factory {
        val httpDataSourceFactory = androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(
            expo.modules.orpheus.network.OkHttpClientManager.okHttpClient
        )
            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0")

        return ResolvingDataSource.Factory(
            DataSource.Factory { BilibiliFallbackDataSource(httpDataSourceFactory) },
            BilibiliResolver()
        )
    }

    @Synchronized
    fun getDownloadNotificationHelper(context: Context): DownloadNotificationHelper {
        if (downloadNotificationHelper == null) {
            downloadNotificationHelper =
                DownloadNotificationHelper(context, OrpheusDownloadService.CHANNEL_ID)
        }
        return downloadNotificationHelper!!
    }

    fun getReadOnlyCacheDataSource(context: Context): CacheDataSource {
        val cache = DownloadCache.getStableCache(context)
        return CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(null) // No upstream, only cache
            .setCacheReadDataSourceFactory(androidx.media3.datasource.FileDataSource.Factory())
            .setFlags(CacheDataSource.FLAG_BLOCK_ON_CACHE)
            .createDataSource()
    }

    private class BilibiliResolver :
        ResolvingDataSource.Resolver {
        override fun resolveDataSpec(dataSpec: DataSpec): DataSpec {
            val uri = dataSpec.uri
            if (uri.scheme == "orpheus" && uri.host == "bilibili") {
                try {
                    val bvid = uri.getQueryParameter("bvid")
                    val cid = uri.getQueryParameter("cid")?.toLongOrNull()
                    val quality = uri.getQueryParameter("quality")?.toIntOrNull() ?: 30280

                    // 读取 JS 侧注入的 Sentry trace header（格式：traceId-spanId-{0|1}）
                    // 用 runCatching 吞掉所有解析失败：trace 是可选的，不影响播放
                    val sentrySpan = uri.getQueryParameter("st")?.let { encodedHeader ->
                        runCatching {
                            val header = java.net.URLDecoder.decode(encodedHeader, "UTF-8")
                            val parts = header.split("-")
                            if (parts.size >= 3) {
                                val sampled = parts[2] == "1"
                                val ctx = TransactionContext.fromSentryTrace(
                                    "bilibili.cdn_resolve",
                                    "bilibili.resolve",
                                    io.sentry.SentryTraceHeader(header)
                                )
                                ctx.samplingDecision = TracesSamplingDecision(sampled)
                                Sentry.startTransaction(ctx)
                            } else null
                        }.getOrNull()
                    }

                    // 去掉 st 参数，让 LoudnessStorage / ExoPlayer cache 使用稳定的 key
                    val stableUri = uri.buildUpon().clearQuery().also { builder ->
                        uri.queryParameterNames
                            .filter { it != "st" }
                            .forEach { key -> builder.appendQueryParameter(key, uri.getQueryParameter(key)) }
                    }.build()

                    val (urls, volume) = try {
                        BilibiliRepository.resolveAudioUrls(
                            bvid = bvid!!,
                            cid = cid,
                            audioQuality = quality,
                            enableDolby = uri.getQueryParameter("dolby") == "1",
                            enableHiRes = uri.getQueryParameter("hires") == "1",
                            cookie = OrpheusConfig.bilibiliCookie,
                            parentSpan = sentrySpan
                        )
                    } catch (e: Exception) {
                        sentrySpan?.status = SpanStatus.INTERNAL_ERROR
                        sentrySpan?.finish()
                        throw e
                    }

                    // 在这里保存响度均衡数据，并且直接发一个事件，在 OrpheusMusicService 监听
                    if (volume !== null) {
                        Log.d(
                            "LoudnessNormalization",
                            "uri: $stableUri, measuredI: ${volume.measuredI}"
                        )
                        LoudnessStorage.setLoudnessData(stableUri.toString(), volume.measuredI)
                    }

                    sentrySpan?.status = SpanStatus.OK
                    sentrySpan?.finish()

                    val headers = HashMap(dataSpec.httpRequestHeaders)
                    headers["Referer"] = "https://www.bilibili.com/"

                    return dataSpec.buildUpon()
                        .setUri(urls.first().toUri())
                        .setCustomData(BilibiliStreamUrls(urls))
                        .setHttpRequestHeaders(headers)
                        .setKey(stableUri.toString())
                        .build()
                } catch (e: Exception) {
                    throw IOException("Resolve Url Failed: ${e.message}", e)
                }
            }
            return dataSpec
        }
    }
}
