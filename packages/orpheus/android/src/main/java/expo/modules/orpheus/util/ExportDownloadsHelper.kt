package expo.modules.orpheus.util

import expo.modules.bbplayernative.telemetry.NativeLog

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CenterCrop
import com.bumptech.glide.request.RequestOptions
import androidx.documentfile.provider.DocumentFile
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadIndex
import expo.modules.orpheus.manager.CoverDownloadManager
import expo.modules.orpheus.model.TrackRecord
import expo.modules.orpheus.model.LyricFileCache
import expo.modules.orpheus.telemetry.LogTags
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.io.ByteArrayOutputStream
import java.io.File


data class ExportOptions(
    val filenamePattern: String?,
    val embedLyrics: Boolean,
    val convertToLrc: Boolean,
    val cropCoverArt: Boolean = false,
)

/** 导出文件的容器格式：Hi-Res 无损取出成 .flac，其余（AAC、杜比 E-AC-3）保留 MP4 容器 */
private enum class ExportFormat(val extension: String, val mimeType: String) {
    M4A("m4a", "audio/mp4"),
    FLAC("flac", "audio/flac"),
}

private const val PUBLIC_MUSIC_DESTINATION_HOST = "public-music"

private fun isPublicMusicDestination(uri: Uri): Boolean {
    return uri.scheme == "orpheus" && uri.host == PUBLIC_MUSIC_DESTINATION_HOST
}


@UnstableApi
fun runExportDownloads(
    ids: List<String>,
    destinationUri: String,
    context: Context,
    options: ExportOptions,
    json: Json,
    ioScope: CoroutineScope,
    sendEvent: (name: String, payload: Map<String, Any?>) -> Unit,
) {
    val downloadManager = DownloadUtil.getDownloadManager(context)
    val downloadIndex = downloadManager.downloadIndex
    val dataSource = DownloadUtil.getReadOnlyCacheDataSource(context)
    val treeUri = Uri.parse(destinationUri)
    val isPublicMusic = isPublicMusicDestination(treeUri)
    val pickedDir =
        if (isPublicMusic) {
            null
        } else {
            DocumentFile.fromTreeUri(context, treeUri)
        }

    if (!isPublicMusic && (pickedDir == null || !pickedDir.canWrite())) {
        NativeLog.error(LogTags.EXPORT, "export.directory.unwritable")
        return
    }

    ioScope.launch {
        val totalFiles = ids.size
        ids.forEachIndexed { index, id ->
            exportSingleItem(
                id = id,
                index = index,
                totalFiles = totalFiles,
                context = context,
                downloadIndex = downloadIndex,
                dataSource = dataSource,
                pickedDir = pickedDir,
                isPublicMusic = isPublicMusic,
                options = options,
                json = json,
                sendEvent = sendEvent,
            )
        }
    }
}


@UnstableApi
private suspend fun exportSingleItem(
    id: String,
    index: Int,
    totalFiles: Int,
    context: Context,
    downloadIndex: DownloadIndex,
    dataSource: CacheDataSource,
    pickedDir: DocumentFile?,
    isPublicMusic: Boolean,
    options: ExportOptions,
    json: Json,
    sendEvent: (name: String, payload: Map<String, Any?>) -> Unit,
) {
    var tempM4a: File? = null
    var tempFlac: File? = null
    try {
        val download = downloadIndex.getDownload(id)
        if (download == null || download.state != Download.STATE_COMPLETED) {
            sendEvent(
                "onExportProgress", mapOf(
                    "currentId" to id,
                    "status" to "error",
                    "message" to "Download not found or not completed",
                )
            )
            return
        }

        // 1. 将缓存数据直接写入临时 m4a 文件（m4s 与 m4a 同为 ISOBMFF 容器，无需转码）
        tempM4a = File(context.cacheDir, "$id.m4a")
        if (tempM4a.exists()) tempM4a.delete()
        val cacheKey = download.request.customCacheKey
            ?.takeIf { it.isNotBlank() }
            ?: DownloadUtil.downloadCacheKeyOf(download.request.uri)
        val dataSpec = DataSpec.Builder()
            .setUri(download.request.uri)
            .setKey(cacheKey)
            .build()
        try {
            dataSource.open(dataSpec)
            tempM4a.outputStream().use { outputStream ->
                val buffer = ByteArray(64 * 1024)
                var bytesRead: Int
                while (dataSource.read(buffer, 0, buffer.size).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                }
            }
        } finally {
            dataSource.close()
        }

        // 2. Hi-Res 无损是装在 MP4 里的 FLAC，原样取出成 .flac（不重新编码）；取不出来就照旧导出 m4a
        tempFlac = File(context.cacheDir, "$id.flac")
        if (tempFlac.exists()) tempFlac.delete()
        val isFlac = runCatching { Fmp4FlacExtractor.extractIfFlac(tempM4a, tempFlac) }
            .onFailure { NativeLog.warning(LogTags.EXPORT, "export.flac.extract_failed", mapOf("track.id" to id), it) }
            .getOrDefault(false)
        val format = if (isFlac) ExportFormat.FLAC else ExportFormat.M4A
        val exportFile = if (isFlac) tempFlac else tempM4a

        // 3. 提前解码 TrackRecord（用于文件名，不依赖元数据写入是否成功）
        val track: TrackRecord? = download.request.data
            .takeIf { it.isNotEmpty() }
            ?.let { runCatching { json.decodeFromString<TrackRecord>(String(it)) }.getOrNull() }

        // 4. 写入元数据（Title / Artist / Cover / Lyrics）
        writeMetadata(
            id = id,
            file = exportFile,
            track = track,
            context = context,
            options = options,
            json = json,
        )

        // 5. 拷贝到 SAF 目标路径
        val fileName = buildFileName(id, download, track, options.filenamePattern, format)
        writeExportedFile(
            context = context,
            file = exportFile,
            format = format,
            fileName = fileName,
            pickedDir = pickedDir,
            isPublicMusic = isPublicMusic,
        )

        sendEvent(
            "onExportProgress", mapOf(
                "progress" to (index + 1).toDouble() / totalFiles,
                "currentId" to id,
                "index" to index + 1,
                "total" to totalFiles,
                "status" to "success",
            )
        )
    } catch (e: Exception) {
        NativeLog.error(LogTags.EXPORT, "export.track.failed", mapOf("track.id" to id), e)
        sendEvent(
            "onExportProgress", mapOf(
                "currentId" to id,
                "index" to index + 1,
                "total" to totalFiles,
                "status" to "error",
                "message" to e.message,
            )
        )
    } finally {
        tempM4a?.delete()
        tempFlac?.delete()
    }
}

private fun writeExportedFile(
    context: Context,
    file: File,
    format: ExportFormat,
    fileName: String,
    pickedDir: DocumentFile?,
    isPublicMusic: Boolean,
) {
    if (isPublicMusic) {
        writeToPublicMusic(context, file, format, fileName)
        return
    }

    val targetDir = pickedDir ?: throw Exception("Destination directory is not available")
    val newFile = targetDir.createFile(format.mimeType, fileName) ?: throw Exception("Failed to create file $fileName in destination")
    try {
        context.contentResolver.openOutputStream(newFile.uri)?.use { outputStream ->
            file.inputStream().use { it.copyTo(outputStream) }
        } ?: throw Exception("Failed to open output stream for $fileName")
    } catch (e: Exception) {
        runCatching { newFile.delete() }
        throw e
    }
}

private fun writeToPublicMusic(
    context: Context,
    file: File,
    format: ExportFormat,
    fileName: String,
) {
    val resolver = context.contentResolver

    // Pre-Q (API < 29): Use legacy external storage directory
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        val musicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
        val bbplayerDir = File(musicDir, "BBPlayer")
        if (!bbplayerDir.exists()) {
            bbplayerDir.mkdirs()
        }

        val targetFile = File(bbplayerDir, fileName)
        try {
            file.inputStream().use { input ->
                targetFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        } catch (e: Exception) {
            // Clean up partially written file on failure
            runCatching { targetFile.delete() }
            throw Exception("Failed to write file to public music directory: ${e.message}", e)
        }

        // Insert into MediaStore with DATA column (legacy approach)
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, format.mimeType)
            put(MediaStore.MediaColumns.DATA, targetFile.absolutePath)
        }

        val itemUri = resolver.insert(collection, values)
        if (itemUri == null) {
            // Clean up file if MediaStore insertion failed
            runCatching { targetFile.delete() }
            throw Exception("Failed to insert public Music item for $fileName into MediaStore")
        }

        return
    }

    // Q+ (API >= 29): Use RELATIVE_PATH approach
    val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    val itemUri = resolver.insert(
        collection,
        ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, format.mimeType)
            put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                "${Environment.DIRECTORY_MUSIC}/BBPlayer",
            )
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        },
    ) ?: throw Exception("Failed to create public Music item for $fileName")

    try {
        resolver.openOutputStream(itemUri)?.use { outputStream ->
            file.inputStream().use { it.copyTo(outputStream) }
        } ?: throw Exception("Failed to open public Music output stream for $fileName")

        resolver.update(
            itemUri,
            ContentValues().apply {
                put(MediaStore.MediaColumns.IS_PENDING, 0)
            },
            null,
            null,
        )
    } catch (e: Exception) {
        resolver.delete(itemUri, null, null)
        throw e
    }
}

// ─────────────────────────────────────────────────────────────
// 元数据写入（文件级私有）
// ─────────────────────────────────────────────────────────────

@UnstableApi
private fun writeMetadata(
    id: String,
    file: File,
    track: TrackRecord?,
    context: Context,
    options: ExportOptions,
    json: Json,
) {
    if (track == null) return

    try {
        val properties = linkedMapOf(
            "TITLE" to (track.title ?: id),
            "ARTIST" to (track.artist ?: "Unknown"),
            "ALBUM" to (track.title ?: ""),
        )
        // 歌词（仅在已缓存且 embedLyrics=true 时写入）
        if (options.embedLyrics) {
            readLyrics(id, options.convertToLrc, context, json)?.let { properties["LYRICS"] = it }
        }

        if (!TagWriter.write(file, properties, readCover(id, context, options))) {
            NativeLog.error(LogTags.EXPORT, "export.metadata.failed", mapOf("track.id" to id))
        }
    } catch (e: Exception) {
        NativeLog.error(LogTags.EXPORT, "export.metadata.failed", mapOf("track.id" to id), e)
    }
}

private fun readCover(id: String, context: Context, options: ExportOptions): TagWriter.Cover? {
    val coverFile = CoverDownloadManager.getCoverFile(context, id)
    if (coverFile == null || !coverFile.exists()) {
        NativeLog.warning(LogTags.EXPORT, "export.cover.missing", mapOf("track.id" to id))
        return null
    }
    return try {
        if (options.cropCoverArt) {
            // 使用 Glide 加载并 centerCrop 裁剪为正方形，
            // 能正确处理 WebP / HEIF 等各种格式及 EXIF 旋转。
            val squareBitmap = Glide.with(context)
                .asBitmap()
                .load(coverFile)
                .apply(RequestOptions().transform(CenterCrop()))
                .submit(1200, 1200)
                .get()
            val bytes = ByteArrayOutputStream().use {
                squareBitmap.compress(Bitmap.CompressFormat.JPEG, 90, it)
                it.toByteArray()
            }
            val cover = TagWriter.Cover(bytes, "image/jpeg", squareBitmap.width, squareBitmap.height)
            squareBitmap.recycle()
            cover
        } else {
            val bytes = coverFile.readBytes()
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            TagWriter.Cover(
                data = bytes,
                mimeType = bounds.outMimeType ?: "image/jpeg",
                width = bounds.outWidth.coerceAtLeast(0),
                height = bounds.outHeight.coerceAtLeast(0),
            )
        }
    } catch (e: Exception) {
        NativeLog.warning(LogTags.EXPORT, "export.cover.embed_failed", mapOf("track.id" to id), e)
        null
    }
}

// ─────────────────────────────────────────────────────────────
// 歌词写入（文件级私有）
// ─────────────────────────────────────────────────────────────

private fun readLyrics(
    id: String,
    convertToLrc: Boolean,
    context: Context,
    json: Json,
): String? {
    return try {
        val lyricsDir = File(context.filesDir, "lyrics")
        val lyricFile = File(lyricsDir, "${id.replace("::", "--")}.json")
        NativeLog.debug(
            LogTags.EXPORT,
            "export.lyrics.check_started",
            mapOf(
                "lyrics.file_exists" to lyricFile.exists(),
            ),
        )
        if (!lyricFile.exists()) return null

        val lyricJson = lyricFile.readText()
        val lrcContent0 = json.decodeFromString<LyricFileCache>(lyricJson).lrc
        if (lrcContent0 == null) {
            NativeLog.warning(LogTags.EXPORT, "export.lyrics.missing", mapOf("track.id" to id))
            return null
        }
        NativeLog.debug(LogTags.EXPORT, "export.lyrics.extracted", mapOf("lyrics.text_length" to lrcContent0.length))

        var lrcContent = lrcContent0

        if (convertToLrc) {
            lrcContent = SplConverter.toStandardLrc(lrcContent)
        }

        lrcContent
    } catch (e: Exception) {
        NativeLog.error(LogTags.EXPORT, "export.lyrics.embed_failed", mapOf("track.id" to id), e)
        null
    }
}

// ─────────────────────────────────────────────────────────────
// 文件名构建（文件级私有）
// ─────────────────────────────────────────────────────────────

@UnstableApi
private fun buildFileName(
    id: String,
    download: Download,
    track: TrackRecord?,
    filenamePattern: String?,
    format: ExportFormat,
): String {
    val pattern = filenamePattern?.takeIf { it.isNotBlank() } ?: "{name}"
    var name = pattern
        .replace("{id}", id)
        .replace("{name}", track?.title ?: id)
        .replace("{artist}", track?.artist ?: "Unknown")

    val uri = download.request.uri
    if (uri.scheme == "orpheus" && uri.host == "bilibili") {
        name = name
            .replace("{bvid}", uri.getQueryParameter("bvid") ?: "")
            .replace("{cid}", uri.getQueryParameter("cid") ?: "")
    } else {
        name = name.replace("{bvid}", "").replace("{cid}", "")
    }

    val safeName = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
    val baseName = safeName.ifEmpty { id }
    return "$baseName.${format.extension}"
}
