package expo.modules.bbplayernative

import android.content.Context
import java.io.File
import java.nio.file.Files

/**
 * 应用私有目录的磁盘占用统计，以及除 Media3 播放缓存外的可丢弃缓存清理。
 *
 * Media3 的下载目录、封面目录与在线播放 LRU 缓存目录由 `@bbplayer/orpheus` 负责写入与清理；
 * 这里只做只读统计，并在清理时跳过 orpheus 持有的 LRU 缓存目录。
 */
object AppStorage {
    /** Media3 在线播放 LRU 缓存目录，由 `expo.modules.orpheus.manager.DownloadCache` 持有并清理。 */
    private const val MEDIA_CACHE_DIR = "media_cache_lru"
    /** 与 `expo.modules.orpheus.manager.DownloadCache` 共享。 */
    private const val MEDIA_DOWNLOAD_DIR = "media_download"
    /** 与 `expo.modules.orpheus.manager.CoverDownloadManager` 共享。 */
    private const val DOWNLOADED_COVERS_DIR = "downloaded_covers"

    /** Media3 在线播放 LRU 缓存上限，需与 `expo.modules.orpheus.manager.DownloadCache` 保持一致。 */
    const val MUSIC_CACHE_MAX_BYTES = 256L * 1024 * 1024

    fun getUsage(context: Context): Map<String, Long> {
        val dataDir = File(context.applicationInfo.dataDir)
        val cacheDir = context.cacheDir
        val mediaCacheDir = File(cacheDir, MEDIA_CACHE_DIR)
        val downloadDir = File(context.filesDir, MEDIA_DOWNLOAD_DIR)
        val downloadedCoversDir = File(context.filesDir, DOWNLOADED_COVERS_DIR)

        // The Media3 LRU playback cache lives inside `cacheDir`; report it separately from the
        // rest of the runtime cache so the UI can show both as distinct slices.
        val musicCacheBytes = sizeOf(mediaCacheDir)
        val runtimeCacheBytes = (sizeOf(cacheDir) - musicCacheBytes).coerceAtLeast(0L)
        val downloadBytes = sizeOf(downloadDir) + sizeOf(downloadedCoversDir)

        val otherBytes = dataDir.listFiles().orEmpty().sumOf { child ->
            when (child.absolutePath) {
                cacheDir.absolutePath -> 0L
                context.filesDir.absolutePath ->
                    child.listFiles().orEmpty().sumOf { file ->
                        if (file.absolutePath == downloadDir.absolutePath ||
                            file.absolutePath == downloadedCoversDir.absolutePath
                        ) 0L else sizeOf(file)
                    }
                else -> sizeOf(child)
            }
        }

        return mapOf(
            "runtimeCacheBytes" to runtimeCacheBytes,
            "musicCacheBytes" to musicCacheBytes,
            "musicCacheMaxBytes" to MUSIC_CACHE_MAX_BYTES,
            "downloadBytes" to downloadBytes,
            "otherBytes" to otherBytes,
            "packageBytes" to packageSizeOf(context),
        )
    }

    /**
     * 清理运行数据缓存：删除 `cacheDir` 中除 Media3 LRU 缓存目录外的全部内容。
     *
     * Media3 LRU 缓存由 `@bbplayer/orpheus` 自行清理（其 `SimpleCache` 实例保持打开，不能直接删
     * 目录）。`filesDir` 下的离线下载与已下载封面不受影响。
     */
    fun clearCache(context: Context) {
        val mediaCacheDir = File(context.cacheDir, MEDIA_CACHE_DIR)
        context.cacheDir.listFiles().orEmpty().forEach { file ->
            if (file.absolutePath != mediaCacheDir.absolutePath && !file.deleteRecursively()) {
                error("Could not clear cache entry: ${file.name}")
            }
        }
    }

    /** Installed package size: the base APK plus every split APK. */
    private fun packageSizeOf(context: Context): Long {
        val appInfo = context.applicationInfo
        val sourceDirs = mutableListOf<String>()
        appInfo.sourceDir?.let(sourceDirs::add)
        appInfo.splitSourceDirs?.let(sourceDirs::addAll)
        return sourceDirs.sumOf { File(it).length() }
    }

    private fun sizeOf(file: File): Long {
        if (!file.exists() || Files.isSymbolicLink(file.toPath())) return 0L
        if (file.isFile) return file.length()
        return file.listFiles().orEmpty().sumOf(::sizeOf)
    }
}
