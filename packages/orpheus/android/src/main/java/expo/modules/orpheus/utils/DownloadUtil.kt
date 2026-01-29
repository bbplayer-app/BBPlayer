package expo.modules.orpheus.utils

import android.content.Context
import android.util.Log
import androidx.core.net.toUri
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.scheduler.Requirements
import expo.modules.orpheus.DownloadCache
import expo.modules.orpheus.OrpheusConfig
import expo.modules.orpheus.OrpheusDownloadService
import expo.modules.orpheus.bilibili.BilibiliRepository
import expo.modules.orpheus.bilibili.VolumeData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import java.io.IOException
import java.util.concurrent.Executors

@UnstableApi
object DownloadUtil {
    private var downloadManager: DownloadManager? = null

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
                maxParallelDownloads = 3
                requirements = Requirements(0)
            }
        }
        return downloadManager!!
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
        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
            .setAllowCrossProtocolRedirects(true)

        return ResolvingDataSource.Factory(
            httpDataSourceFactory,
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

    private class BilibiliResolver :
        ResolvingDataSource.Resolver {
        override fun resolveDataSpec(dataSpec: DataSpec): DataSpec {
            val uri = dataSpec.uri
            if (uri.scheme == "orpheus" && uri.host == "bilibili") {
                try {
                    val bvid = uri.getQueryParameter("bvid")
                    val cid = uri.getQueryParameter("cid")?.toLongOrNull()
                    val quality = uri.getQueryParameter("quality")?.toIntOrNull() ?: 30280
                    val (realUrl, volume) = BilibiliRepository.resolveAudioUrl(
                        bvid = bvid!!,
                        cid = cid,
                        audioQuality = quality,
                        enableDolby = uri.getQueryParameter("dolby") == "1",
                        enableHiRes = uri.getQueryParameter("hires") == "1",
                        cookie = OrpheusConfig.bilibiliCookie
                    )
                    // 在这里保存响度均衡数据，并且直接发一个事件，在 OrpheusMusicService 监听
                    if (volume !== null) {
                        Log.d("LoudnessNormalization", "uri: ${dataSpec.uri}, measuredI: ${volume.measuredI}")
                        LoudnessStorage.setLoudnessData(dataSpec.uri.toString(), volume.measuredI)
                    }

                    val headers = HashMap<String, String>()
                    headers["Referer"] = "https://www.bilibili.com/"

                    return dataSpec.buildUpon()
                        .setUri(realUrl.toUri())
                        .setHttpRequestHeaders(headers)
                        .setKey(uri.toString())
                        .build()
                } catch (e: Exception) {
                    throw IOException("Resolve Url Failed: ${e.message}", e)
                }
            }
            return dataSpec
        }
    }
}