package expo.modules.orpheus.util

import android.content.Context
import android.net.Uri
import androidx.core.net.toUri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.ContentMetadata
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.scheduler.Requirements
import expo.modules.orpheus.OrpheusConfig
import expo.modules.orpheus.bilibili.BilibiliRepository
import expo.modules.orpheus.manager.AudioQualityInfo
import expo.modules.orpheus.manager.AudioQualityStore
import expo.modules.orpheus.manager.DownloadCache
import expo.modules.orpheus.network.BilibiliFallbackDataSource
import expo.modules.orpheus.network.BilibiliStreamUrls
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.OrpheusTelemetry
import expo.modules.orpheus.telemetry.PlaybackTracer
import expo.modules.orpheus.service.OrpheusDownloadService
import java.io.IOException
import java.util.concurrent.Executors
import io.sentry.SpanStatus

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
            val upstreamFactory = getUpstreamFactory(forPlayback = true)

            val downloadCache = DownloadCache.getStableCache(context)
            val lruCache = DownloadCache.getLruCache(context)

            val cacheFactory = CacheDataSource.Factory()
                .setCache(lruCache)
                .setUpstreamDataSourceFactory(upstreamFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                .setCacheKeyFactory { dataSpec -> buildCacheKey(dataSpec) }

            val downloadFactory = CacheDataSource.Factory()
                .setCache(downloadCache)
                .setUpstreamDataSourceFactory(cacheFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                .setCacheWriteDataSinkFactory(null)
                .setCacheKeyFactory { dataSpec ->
                    val uri = dataSpec.uri
                    if (uri.scheme == "orpheus" && uri.host == "bilibili") {
                        downloadCacheKeyOf(uri)
                    } else {
                        dataSpec.key ?: uri.toString()
                    }
                }

            val appContext = context.applicationContext
            playerDataSourceFactory = DataSource.Factory {
                DownloadCacheAwareDataSource(
                    appContext,
                    downloadFactory.createDataSource(),
                    cacheFactory.createDataSource(),
                )
            }
        }
        return playerDataSourceFactory!!
    }

    const val AUDIO_QUALITY_QUERY_PARAM = "q"

    fun playbackCacheKey(uriString: String): String = "$uriString|q=${GeneralStorage.getPreferredAudioQuality()}"

    /**
     * 下载请求的 URI 固定记录发起时的音质，恢复下载时沿用同一档位
     */
    fun downloadRequestUriOf(url: String): Uri {
        val uri = url.toUri()
        if (uri.scheme != "orpheus" || uri.host != "bilibili") return uri
        return uri.buildUpon()
            .appendQueryParameter(AUDIO_QUALITY_QUERY_PARAM, GeneralStorage.getPreferredAudioQuality())
            .build()
    }

    /**
     * 下载缓存 key：B 站 URI 去掉定档参数后直接使用 URI 本身，保持与既有下载缓存兼容
     */
    fun downloadCacheKeyOf(uri: Uri): String {
        val uriString = uri.toString()
        if (uri.scheme != "orpheus" || uri.host != "bilibili") return uriString
        val quality = uri.getQueryParameter(AUDIO_QUALITY_QUERY_PARAM) ?: return uriString
        val suffix = "&$AUDIO_QUALITY_QUERY_PARAM=$quality"
        if (uriString.endsWith(suffix)) return uriString.dropLast(suffix.length)
        val onlyParam = "?$AUDIO_QUALITY_QUERY_PARAM=$quality"
        if (uriString.endsWith(onlyParam)) return uriString.dropLast(onlyParam.length)
        return uriString
    }

    fun downloadCacheKeyOf(uriString: String): String = downloadCacheKeyOf(uriString.toUri())

    private fun buildCacheKey(dataSpec: DataSpec): String {
        val uri = dataSpec.uri
        if (uri.scheme == "orpheus" && uri.host == "bilibili") {
            return playbackCacheKey(uri.toString())
        }
        return dataSpec.key ?: uri.toString()
    }

    private fun isFullyCached(cache: Cache, cacheKey: String): Boolean = try {
        val contentLength = ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey))
        contentLength != C.LENGTH_UNSET.toLong() &&
            contentLength > 0L &&
            cache.getCachedSpans(cacheKey).sumOf { it.length } >= contentLength
    } catch (e: Exception) {
        false
    }

    fun isFullyCachedInLruCache(context: Context, cacheKey: String): Boolean =
        isFullyCached(DownloadCache.getLruCache(context), cacheKey)

    fun isFullyCachedInDownloadCache(context: Context, uriString: String): Boolean =
        isFullyCached(DownloadCache.getStableCache(context), downloadCacheKeyOf(uriString))


    @Synchronized
    private fun getDownloadDataSourceFactory(): DataSource.Factory {
        if (downloadDataSourceFactory == null) {
            downloadDataSourceFactory = getUpstreamFactory(forPlayback = false)
        }
        return downloadDataSourceFactory!!
    }

    private fun getUpstreamFactory(forPlayback: Boolean): DataSource.Factory {
        val httpDataSourceFactory = androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(
            expo.modules.orpheus.network.OkHttpClientManager.okHttpClient
        )
            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0")

        return ResolvingDataSource.Factory(
            DataSource.Factory { BilibiliFallbackDataSource(httpDataSourceFactory) },
            BilibiliResolver(forPlayback)
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

    private class DownloadCacheAwareDataSource(
        private val context: Context,
        private val downloadDataSource: DataSource,
        private val fallbackDataSource: DataSource,
    ) : DataSource {
        private var activeDataSource: DataSource = downloadDataSource

        override fun addTransferListener(transferListener: TransferListener) {
            downloadDataSource.addTransferListener(transferListener)
            fallbackDataSource.addTransferListener(transferListener)
        }

        override fun open(dataSpec: DataSpec): Long {
            val uri = dataSpec.uri
            activeDataSource = if (
                uri.scheme == "orpheus" &&
                uri.host == "bilibili" &&
                !DownloadUtil.isFullyCachedInDownloadCache(context, uri.toString())
            ) {
                fallbackDataSource
            } else {
                downloadDataSource
            }
            return activeDataSource.open(dataSpec)
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
            activeDataSource.read(buffer, offset, length)

        override fun getUri(): Uri? = activeDataSource.uri

        override fun getResponseHeaders(): Map<String, List<String>> =
            activeDataSource.responseHeaders

        override fun close() {
            activeDataSource.close()
        }
    }

    private class BilibiliResolver(private val forPlayback: Boolean) :
        ResolvingDataSource.Resolver {
        override fun resolveDataSpec(dataSpec: DataSpec): DataSpec {
            val uri = dataSpec.uri
            if (uri.scheme == "orpheus" && uri.host == "bilibili") {
                val resolveSpan = if (forPlayback) PlaybackTracer.spanForResolve(uri.toString()) else null
                var resolveStatus = SpanStatus.INTERNAL_ERROR
                try {
                    val bvid = uri.getQueryParameter("bvid")
                    val cid = uri.getQueryParameter("cid")?.toLongOrNull()
                    val request = AudioQualityStore.requestFor(
                        uri.getQueryParameter(AUDIO_QUALITY_QUERY_PARAM)
                            ?: GeneralStorage.getPreferredAudioQuality()
                    )
                    val resolved = BilibiliRepository.resolveAudioUrls(
                        bvid = bvid!!,
                        cid = cid,
                        audioQuality = request.audioQuality,
                        enableDolby = request.enableDolby,
                        enableHiRes = request.enableHiRes,
                        cookie = OrpheusConfig.bilibiliCookie,
                        parent = resolveSpan,
                    )
                    val urls = resolved.urls
                    // 下载和播放可能是同一首歌，下载取到的流不能覆盖播放的
                    if (forPlayback) {
                        OrpheusTelemetry.recordStream(
                            uri.toString(),
                            buildMap {
                                put("kind", resolved.kind)
                                resolved.streamId?.let { put("id", it) }
                                resolved.codecs?.let { put("codecs", it) }
                                resolved.bandwidth?.let { put("bandwidth", it) }
                                put("mirrors", urls.size)
                            },
                        )
                        AudioQualityStore.put(
                            uri.toString(),
                            AudioQualityInfo(
                                preferredQuality = request.preference,
                                actualKind = resolved.kind,
                                actualStreamId = resolved.streamId,
                                codecs = resolved.codecs,
                                bandwidth = resolved.bandwidth,
                                isFallback = AudioQualityStore.isFallback(request.preference, resolved.kind, resolved.streamId),
                                isFromDownloadCache = false,
                                availableQualities = resolved.availableQualities,
                            ),
                        )
                    }
                    // 在这里保存响度均衡数据，并且直接发一个事件，在 OrpheusMusicService 监听
                    val volume = resolved.volume
                    if (volume !== null) {
                        NativeLog.debug(
                            LogTags.LOUDNESS,
                            "audio.loudness.resolved",
                            mapOf(
                                "bilibili.bvid" to bvid,
                                "audio.integrated_loudness_lufs" to volume.measuredI,
                                "audio.true_peak_dbtp" to volume.measuredTp,
                            ),
                        )
                        LoudnessStorage.setLoudnessData(dataSpec.uri.toString(), volume.measuredI)
                        volume.measuredTp?.let { LoudnessStorage.setTruePeak(dataSpec.uri.toString(), it) }
                    }

                    val headers = HashMap(dataSpec.httpRequestHeaders)
                    headers["Referer"] = "https://www.bilibili.com/"

                    val resolvedSpec = dataSpec.buildUpon()
                        .setUri(urls.first().toUri())
                        .setCustomData(BilibiliStreamUrls(urls, uri.toString().takeIf { forPlayback }))
                        .setHttpRequestHeaders(headers)
                        .setKey(if (forPlayback) uri.toString() else downloadCacheKeyOf(uri))
                        .build()
                    resolveStatus = SpanStatus.OK
                    return resolvedSpec
                } catch (e: Exception) {
                    if (forPlayback) OrpheusTelemetry.recordStream(uri.toString(), mapOf("kind" to "resolve_failed"))
                    // 播放器会重试，重试耗尽才会变成 onPlayerError
                    NativeLog.warning(
                        LogTags.STREAM,
                        "stream.resolve.failed",
                        mapOf(
                            "bilibili.bvid" to uri.getQueryParameter("bvid"),
                        ),
                        e,
                    )
                    throw IOException("Resolve Url Failed: ${e.message}", e)
                } finally {
                    PlaybackTracer.onResolveFinished(resolveSpan, resolveStatus)
                }
            }
            return dataSpec
        }
    }
}
