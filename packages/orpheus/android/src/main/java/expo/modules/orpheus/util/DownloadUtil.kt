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
import expo.modules.orpheus.manager.CachedUriManager
import expo.modules.orpheus.manager.DownloadCache
import expo.modules.orpheus.manager.DolbySupport
import expo.modules.orpheus.network.BilibiliFallbackDataSource
import expo.modules.orpheus.network.BilibiliStreamUrls
import expo.modules.orpheus.telemetry.LogTags
import expo.modules.bbplayernative.telemetry.NativeLog
import expo.modules.orpheus.telemetry.OrpheusTelemetry
import expo.modules.orpheus.telemetry.PlaybackTracer
import expo.modules.orpheus.service.OrpheusDownloadService
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
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
                .setCacheKeyFactory { dataSpec ->
                    if (isBilibiliUri(dataSpec.uri)) {
                        playbackCacheKeyOf(dataSpec.uri)
                    } else {
                        dataSpec.key ?: dataSpec.uri.toString()
                    }
                }

            val downloadFactory = CacheDataSource.Factory()
                .setCache(downloadCache)
                .setUpstreamDataSourceFactory(cacheFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                .setCacheWriteDataSinkFactory(null)
                .setCacheKeyFactory { dataSpec ->
                    if (isBilibiliUri(dataSpec.uri)) {
                        downloadCacheKeyOf(dataSpec.uri)
                    } else {
                        dataSpec.key ?: dataSpec.uri.toString()
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

    /** 每首歌最近一次打开播放数据源时锁定的音质，key 为不带 q 参数的原始 URI */
    private val pinnedPlaybackQualities = ConcurrentHashMap<String, String>()

    fun isBilibiliUri(uri: Uri): Boolean = uri.scheme == "orpheus" && uri.host == "bilibili"

    /** 当前（或最近一次）播放这首歌时实际请求的音质；还没打开过则为 null */
    fun pinnedPlaybackQualityOf(uriString: String): String? = pinnedPlaybackQualities[uriString]

    fun clearPinnedPlaybackQualities() {
        pinnedPlaybackQualities.clear()
    }

    /** 设备没有杜比解码能力时杜比按 Hi-Res 请求，见 [DolbySupport.isDolbyPlayable] */
    private fun playableQualityOf(preference: String): String {
        val normalized = AudioQualityStore.normalizePreference(preference)
        return if (normalized == AudioQualityStore.PREF_DOLBY && !DolbySupport.isDolbyPlayable()) {
            AudioQualityStore.PREF_HIRES
        } else {
            normalized
        }
    }

    private fun qualityParamOf(uri: Uri): String? =
        uri.getQueryParameter(AUDIO_QUALITY_QUERY_PARAM)?.let(AudioQualityStore::normalizePreference)

    private fun withQuality(uri: Uri, quality: String): Uri =
        stripQuality(uri).buildUpon()
            .appendQueryParameter(AUDIO_QUALITY_QUERY_PARAM, AudioQualityStore.normalizePreference(quality))
            .build()

    /** 去掉 q 参数，得到前端传入的原始 URI（同时也是下载缓存的 key） */
    fun stripQuality(uri: Uri): Uri {
        if (!isBilibiliUri(uri) || !uri.queryParameterNames.contains(AUDIO_QUALITY_QUERY_PARAM)) return uri
        val builder = uri.buildUpon().clearQuery()
        for (name in uri.queryParameterNames) {
            if (name == AUDIO_QUALITY_QUERY_PARAM) continue
            for (value in uri.getQueryParameters(name)) {
                builder.appendQueryParameter(name, value)
            }
        }
        return builder.build()
    }

    /**
     * 在线播放缓存（LRU）的 key。不同音质是不同的文件，必须分开缓存；
     * high 沿用不带后缀的旧 key，升级前缓存的内容（当时都是 high）还能继续命中
     */
    fun playbackCacheKeyOf(uriString: String, quality: String): String {
        val normalized = AudioQualityStore.normalizePreference(quality)
        return if (normalized == AudioQualityStore.PREF_HIGH) uriString else "$uriString|q=$normalized"
    }

    private fun playbackCacheKeyOf(uri: Uri): String =
        playbackCacheKeyOf(
            stripQuality(uri).toString(),
            qualityParamOf(uri) ?: GeneralStorage.getPreferredAudioQuality(),
        )

    /** 任意一档音质完整缓存在 LRU 里 */
    fun isFullyCachedInAnyPlaybackQuality(uriString: String): Boolean =
        AudioQualityStore.ALL_PREFERENCES.any { quality ->
            CachedUriManager.isFullyCached(playbackCacheKeyOf(uriString, quality))
        }

    /**
     * 下载请求的 URI 固定记录发起时的音质，恢复下载时沿用同一档位
     */
    fun downloadRequestUriOf(url: String, preferredQuality: String? = null): Uri {
        val uri = url.toUri()
        if (!isBilibiliUri(uri)) return uri
        return withQuality(uri, preferredQuality ?: GeneralStorage.getPreferredAudioQuality())
    }

    /**
     * 下载缓存 key：B 站 URI 去掉定档参数后直接使用 URI 本身，保持与既有下载缓存兼容
     */
    fun downloadCacheKeyOf(uri: Uri): String = stripQuality(uri).toString()

    fun downloadCacheKeyOf(uriString: String): String = downloadCacheKeyOf(uriString.toUri())

    private fun isFullyCached(cache: Cache, cacheKey: String): Boolean = try {
        val contentLength = ContentMetadata.getContentLength(cache.getContentMetadata(cacheKey))
        contentLength != C.LENGTH_UNSET.toLong() &&
            contentLength > 0L &&
            cache.getCachedSpans(cacheKey).sumOf { it.length } >= contentLength
    } catch (e: Exception) {
        false
    }

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

    /**
     * 播放器为每个 MediaPeriod 创建一个 DataSource，同一首歌的 seek、出错重试都复用它。
     * 第一次 open 时锁定「读下载缓存还是在线播放」以及在线播放的音质，之后不再看全局设置，
     * 否则切换音质后已经预加载的歌、或者正在下载完成的歌，会把两个不同文件的字节拼在一起。
     * 切换音质时由服务 stop + prepare 重建所有 MediaPeriod，新的 DataSource 才会用上新档位。
     */
    private class DownloadCacheAwareDataSource(
        private val context: Context,
        private val downloadDataSource: DataSource,
        private val fallbackDataSource: DataSource,
    ) : DataSource {
        private var activeDataSource: DataSource = downloadDataSource
        private var useDownload: Boolean? = null
        private var pinnedQuality: String? = null

        override fun addTransferListener(transferListener: TransferListener) {
            downloadDataSource.addTransferListener(transferListener)
            fallbackDataSource.addTransferListener(transferListener)
        }

        override fun open(dataSpec: DataSpec): Long {
            val uri = dataSpec.uri
            if (!isBilibiliUri(uri)) {
                activeDataSource = downloadDataSource
                return downloadDataSource.open(dataSpec)
            }
            val baseUri = stripQuality(uri).toString()
            val download = useDownload
                ?: isFullyCachedInDownloadCache(context, baseUri).also { useDownload = it }
            if (download) {
                activeDataSource = downloadDataSource
                return downloadDataSource.open(dataSpec)
            }
            val quality = pinnedQuality
                ?: (qualityParamOf(uri) ?: AudioQualityStore.normalizePreference(GeneralStorage.getPreferredAudioQuality()))
                    .also { pinnedQuality = it }
            pinnedPlaybackQualities[baseUri] = quality
            activeDataSource = fallbackDataSource
            return fallbackDataSource.open(dataSpec.buildUpon().setUri(withQuality(uri, quality)).build())
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
            val requestUri = dataSpec.uri
            if (isBilibiliUri(requestUri)) {
                // 记录、响度、遥测都按前端传入的原始 URI 存，q 参数只决定请求哪一档
                val uri = stripQuality(requestUri)
                val resolveSpan = if (forPlayback) PlaybackTracer.spanForResolve(uri.toString()) else null
                var resolveStatus = SpanStatus.INTERNAL_ERROR
                try {
                    val bvid = uri.getQueryParameter("bvid")
                    val cid = uri.getQueryParameter("cid")?.toLongOrNull()
                    val request = AudioQualityStore.requestFor(
                        playableQualityOf(qualityParamOf(requestUri) ?: GeneralStorage.getPreferredAudioQuality())
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
                        LoudnessStorage.setLoudnessData(uri.toString(), volume.measuredI)
                        volume.measuredTp?.let { LoudnessStorage.setTruePeak(uri.toString(), it) }
                    }

                    val headers = HashMap(dataSpec.httpRequestHeaders)
                    headers["Referer"] = "https://www.bilibili.com/"

                    val resolvedSpec = dataSpec.buildUpon()
                        .setUri(urls.first().toUri())
                        .setCustomData(BilibiliStreamUrls(urls, uri.toString().takeIf { forPlayback }))
                        .setHttpRequestHeaders(headers)
                        .setKey(uri.toString())
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
