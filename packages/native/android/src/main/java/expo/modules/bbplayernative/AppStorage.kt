package expo.modules.bbplayernative

import android.content.Context
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
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

    fun getUsage(context: Context): StorageUsage {
        val dataDir = File(context.applicationInfo.dataDir)
        val cacheDir = context.cacheDir
        val mediaCacheDir = File(cacheDir, MEDIA_CACHE_DIR)
        val downloadDir = File(context.filesDir, MEDIA_DOWNLOAD_DIR)
        val downloadedCoversDir = File(context.filesDir, DOWNLOADED_COVERS_DIR)

        // The Media3 LRU playback cache lives inside `cacheDir`; report it separately from the
        // rest of the runtime cache so the UI can show both as distinct slices.
        val musicCache = sizeOf(mediaCacheDir)
        val runtimeCache = (sizeOf(cacheDir) - musicCache).coerceAtLeast(0L)

        val other = dataDir.listFiles().orEmpty().sumOf { child ->
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

        return StorageUsage().apply {
            runtimeCacheBytes = runtimeCache
            musicCacheBytes = musicCache
            musicCacheMaxBytes = MUSIC_CACHE_MAX_BYTES
            downloadBytes = sizeOf(downloadDir) + sizeOf(downloadedCoversDir)
            otherBytes = other
            packageBytes = packageSizeOf(context)
        }
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

    /**
     * 只读列出应用私有目录下 [relativePath] 的内容。
     *
     * 只允许访问 [Context.getApplicationInfo] 的 `dataDir` 内部；返回项的 `path` 是相对 `dataDir`
     * 的路径，供前端继续下钻。符号链接（如 `lib`）不会被视为可进入的目录。
     */
    fun listDirectory(context: Context, relativePath: String): List<StorageEntry> {
        val root = File(context.applicationInfo.dataDir).canonicalFile
        val prefix = relativePath.trim().trim('/')
        val target = (if (prefix.isEmpty()) root else File(root, prefix)).canonicalFile

        if (target != root && !target.path.startsWith(root.path + File.separator)) {
            throw IllegalArgumentException("路径不在应用私有目录内")
        }
        if (!target.isDirectory) {
            throw IllegalArgumentException("目录不存在：$relativePath")
        }

        return target.listFiles().orEmpty()
            .sortedWith(
                compareByDescending<File> { it.isDirectory }
                    .thenBy { it.name.lowercase() },
            )
            .map { file ->
                val isSymlink = Files.isSymbolicLink(file.toPath())
                StorageEntry().apply {
                    name = file.name
                    path = if (prefix.isEmpty()) file.name else "$prefix/${file.name}"
                    isDirectory = file.isDirectory && !isSymlink
                    sizeBytes = sizeOf(file)
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

@OptimizedRecord
class StorageUsage : Record {
    @Field
    var runtimeCacheBytes: Long = 0

    @Field
    var musicCacheBytes: Long = 0

    @Field
    var musicCacheMaxBytes: Long = 0

    @Field
    var downloadBytes: Long = 0

    @Field
    var otherBytes: Long = 0

    @Field
    var packageBytes: Long = 0
}

@OptimizedRecord
class StorageEntry : Record {
    @Field
    var name: String = ""

    @Field
    var path: String = ""

    @Field
    var isDirectory: Boolean = false

    @Field
    var sizeBytes: Long = 0
}
