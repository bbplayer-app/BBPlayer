package expo.modules.bbplayernative

import android.content.Context
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.io.File
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes

/**
 * 应用私有目录的磁盘占用统计，以及除 Media3 播放缓存外的可丢弃缓存清理。
 *
 * Media3 的下载目录、封面目录与在线播放 LRU 缓存目录由 `@bbplayer/orpheus` 负责写入与清理；
 * 这里只做只读统计，并在清理时跳过 orpheus 持有的 LRU 缓存目录。
 *
 * Android 没有「直接获取目录大小」的接口（文件系统不维护目录聚合大小），因此所有大小都靠
 * 一次 [Files.walkFileTree] 遍历：每个条目只做一次 `readAttributes` 就能同时拿到类型与大小，
 * 且默认不跟随符号链接。
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
        // The Media3 LRU playback cache lives inside `cacheDir`; report it separately from the
        // rest of the runtime cache so the UI can show both as distinct slices.
        val mediaCacheDir = context.cacheDir.toPath().resolve(MEDIA_CACHE_DIR)
        val cacheDir = context.cacheDir.toPath()
        val filesDir = context.filesDir.toPath()
        val downloadDir = filesDir.resolve(MEDIA_DOWNLOAD_DIR)
        val downloadedCoversDir = filesDir.resolve(DOWNLOADED_COVERS_DIR)

        // 一次遍历 `dataDir`，按路径归属累加到各个分类，避免对同一棵子树重复扫描。
        var musicCache = 0L
        var runtimeCache = 0L
        var download = 0L
        var other = 0L
        walkFiles(File(context.applicationInfo.dataDir).toPath()) { path, size ->
            when {
                path.startsWith(mediaCacheDir) -> musicCache += size
                path.startsWith(cacheDir) -> runtimeCache += size
                path.startsWith(downloadDir) || path.startsWith(downloadedCoversDir) ->
                    download += size
                else -> other += size
            }
        }

        return StorageUsage().apply {
            runtimeCacheBytes = runtimeCache
            musicCacheBytes = musicCache
            musicCacheMaxBytes = MUSIC_CACHE_MAX_BYTES
            downloadBytes = download
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
     *
     * 只统计文件大小，目录的 `sizeBytes` 固定为 0（不递归统计目录），因此每个子项仅需一次
     * `readAttributes`。
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
            .map { child ->
                val attrs = attributesOrNull(child.toPath())
                val isSymlink = attrs?.isSymbolicLink ?: false
                val directory = (attrs?.isDirectory ?: false) && !isSymlink
                StorageEntry().apply {
                    name = child.name
                    path = if (prefix.isEmpty()) child.name else "$prefix/${child.name}"
                    isDirectory = directory
                    sizeBytes = if (directory) 0L else (attrs?.size() ?: 0L)
                }
            }
            .sortedWith(
                compareByDescending<StorageEntry> { it.isDirectory }
                    .thenBy { it.name.lowercase() },
            )
    }

    /** Installed package size: the base APK plus every split APK. */
    private fun packageSizeOf(context: Context): Long {
        val appInfo = context.applicationInfo
        val sourceDirs = mutableListOf<String>()
        appInfo.sourceDir?.let(sourceDirs::add)
        appInfo.splitSourceDirs?.let(sourceDirs::addAll)
        return sourceDirs.sumOf { File(it).length() }
    }

    /**
     * 遍历 [root] 下的所有普通文件，对每个文件回调其路径与大小。
     *
     * 默认不跟随符号链接，因此符号链接本身与其指向的内容都不会被计入；不可读的条目会被跳过。
     */
    private fun walkFiles(root: Path, onFile: (Path, Long) -> Unit) {
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return

        try {
            Files.walkFileTree(
                root,
                object : SimpleFileVisitor<Path>() {
                    override fun visitFile(
                        file: Path,
                        attrs: BasicFileAttributes,
                    ): FileVisitResult {
                        if (!attrs.isSymbolicLink) {
                            onFile(file, attrs.size())
                        }
                        return FileVisitResult.CONTINUE
                    }

                    override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult =
                        FileVisitResult.CONTINUE
                },
            )
        } catch (_: IOException) {
            // 遍历途中目录被删除等；返回已统计的部分即可。
        }
    }

    private fun attributesOrNull(path: Path): BasicFileAttributes? =
        try {
            Files.readAttributes(
                path,
                BasicFileAttributes::class.java,
                LinkOption.NOFOLLOW_LINKS,
            )
        } catch (_: IOException) {
            null
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

    // 显式指定 key，避免 introspection 对 `is` 前缀布尔属性改名。
    @Field(key = "isDirectory")
    var isDirectory: Boolean = false

    @Field
    var sizeBytes: Long = 0
}
