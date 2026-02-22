package expo.modules.orpheus.manager

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap

object CoverDownloadManager {
    private const val TAG = "CoverDownloadManager"
    private const val COVERS_DIR = "downloaded_covers"

    private val okHttpClient = OkHttpClient()

    @Volatile
    private var coverCache: ConcurrentHashMap<String, File>? = null
    private val downloadLocks = ConcurrentHashMap<String, Mutex>()

    fun getCoversDir(context: Context): File {
        return File(context.filesDir, COVERS_DIR)
    }

    private fun initCacheIfNeeded(context: Context) {
        if (coverCache != null) return

        synchronized(this) {
            if (coverCache != null) return
            val newCache = ConcurrentHashMap<String, File>()
            val dir = getCoversDir(context)
            if (dir.exists()) {
                dir.listFiles()?.forEach { file ->
                    newCache[file.nameWithoutExtension] = file
                }
            }
            coverCache = newCache
        }
    }

    /**
     * 获取已下载的封面路径，如果不存在则返回 null。
     * 支持任意扩展名的模糊匹配。
     */
    fun getCoverFile(context: Context, trackId: String): File? {
        initCacheIfNeeded(context)
        val safeId = sanitizeTrackId(trackId)
        return coverCache?.get(safeId)
    }

    /**
     * 将 trackId 中的文件系统非法字符替换为 _，确保可作为文件名。
     */
    private fun sanitizeTrackId(trackId: String): String {
        return trackId.replace(Regex("[/\\\\:*?\"<>|]"), "_")
    }

    /**
     * 从 URL 提取文件扩展名，默认 jpg。
     * 处理 Bilibili 风格的 URL（如 xxx.jpg@100w_100h.webp）。
     */
    private fun extractExtension(url: String): String {
        return try {
            // 先去掉 query 和 fragment
            val cleanUrl = url.split("?")[0].split("#")[0]
            // 再去掉 @ 后缀（如 @100w_100h.webp）
            val pathPart = cleanUrl.split("@")[0]
            val lastDot = pathPart.lastIndexOf('.')
            if (lastDot != -1) {
                pathPart.substring(lastDot + 1).lowercase()
            } else "jpg"
        } catch (_: Exception) {
            "jpg"
        }
    }

    /**
     * 下载封面到本地。如果已存在则跳过。
     * 使用 Glide 下载，禁用 Glide 磁盘缓存以避免双重缓存。
     */
    suspend fun downloadCover(context: Context, trackId: String, artworkUrl: String) {
        val safeId = sanitizeTrackId(trackId)
        val mutex = downloadLocks.getOrPut(safeId) { Mutex() }

        mutex.withLock {
            withContext(Dispatchers.IO) {
                // 如果已存在，跳过
                if (getCoverFile(context, trackId) != null) {
                    Log.d(TAG, "Cover already exists for $trackId, skipping")
                    return@withContext
                }

                val ext = extractExtension(artworkUrl)
                val dir = getCoversDir(context)
                if (!dir.exists()) dir.mkdirs()
                val targetFile = File(dir, "$safeId.$ext")
                val tempFile = File(dir, "$safeId.tmp")

                try {
                    val safeUrl = artworkUrl.replace("http://", "https://")

                    val request = Request.Builder()
                        .url(safeUrl)
                        .header(
                            "User-Agent",
                            "Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/112.0"
                        )
                        .build()

                    okHttpClient.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) {
                            throw Exception("HTTP error code: ${response.code}")
                        }
                        response.body?.byteStream()?.use { input ->
                            FileOutputStream(tempFile).use { output ->
                                input.copyTo(output)
                            }
                        } ?: throw Exception("Empty response body")
                    }

                    if (tempFile.renameTo(targetFile)) {
                        Log.d(
                            TAG,
                            "Downloaded cover for $trackId ($artworkUrl) -> ${targetFile.absolutePath}"
                        )
                        initCacheIfNeeded(context)
                        coverCache?.put(safeId, targetFile)
                    } else {
                        throw Exception("Failed to rename temp file to target file")
                    }
                } catch (e: Exception) {
                    Log.e(
                        TAG,
                        "Failed to download cover for $trackId, url=$artworkUrl: ${e.message}"
                    )
                    // 清理可能的部分文件
                    tempFile.delete()
                    targetFile.delete() // Also try to delete target file just in case
                }
            }
        }
    }

    /**
     * 删除指定歌曲的封面（支持任意扩展名）。
     */
    fun deleteCover(context: Context, trackId: String) {
        val file = getCoverFile(context, trackId)
        if (file != null && file.delete()) {
            val safeId = sanitizeTrackId(trackId)
            coverCache?.remove(safeId)
            Log.d(TAG, "Deleted cover for $trackId")
        }
    }

    /**
     * 删除所有封面。
     */
    fun deleteAllCovers(context: Context) {
        val dir = getCoversDir(context)
        if (dir.exists()) {
            dir.deleteRecursively()
            coverCache?.clear()
            Log.d(TAG, "Deleted all covers")
        }
    }
}
