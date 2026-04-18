package expo.modules.orpheus.util

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.CenterCrop
import com.bumptech.glide.request.RequestOptions
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadIndex
import expo.modules.orpheus.manager.CoverDownloadManager
import expo.modules.orpheus.model.TrackRecord
import expo.modules.orpheus.model.LyricFileCache
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import org.jaudiotagger.tag.images.ArtworkFactory
import java.io.File


data class ExportOptions(
    val filenamePattern: String?,
    val embedLyrics: Boolean,
    val convertToLrc: Boolean,
    val cropCoverArt: Boolean = false,
)

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
        Log.e("OrpheusExport", "Destination directory is not writable: $destinationUri")
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
        val dataSpec = DataSpec(download.request.uri)
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

        // 2. 提前解码 TrackRecord（用于文件名，不依赖元数据写入是否成功）
        val track: TrackRecord? = download.request.data
            .takeIf { it.isNotEmpty() }
            ?.let { runCatching { json.decodeFromString<TrackRecord>(String(it)) }.getOrNull() }

        // 3. 写入元数据（Title / Artist / Cover / Lyrics）
        writeMetadata(
            id = id,
            tempM4a = tempM4a,
            track = track,
            context = context,
            options = options,
            json = json,
        )

        // 4. 拷贝到 SAF 目标路径
        val fileName = buildFileName(id, download, track, options.filenamePattern)
        writeExportedFile(
            context = context,
            tempM4a = tempM4a,
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
        Log.e("OrpheusExport", "Failed to export $id: ${e.message}")
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
    }
}

private fun writeExportedFile(
    context: Context,
    tempM4a: File,
    fileName: String,
    pickedDir: DocumentFile?,
    isPublicMusic: Boolean,
) {
    if (isPublicMusic) {
        writeToPublicMusic(context, tempM4a, fileName)
        return
    }

    val targetDir = pickedDir ?: throw Exception("Destination directory is not available")
    val newFile = targetDir.createFile("audio/mp4", fileName) ?: throw Exception("Failed to create file $fileName in destination")
    try {
        context.contentResolver.openOutputStream(newFile.uri)?.use { outputStream ->
            tempM4a.inputStream().use { it.copyTo(outputStream) }
        } ?: throw Exception("Failed to open output stream for $fileName")
    } catch (e: Exception) {
        runCatching { newFile.delete() }
        throw e
    }
}

private fun writeToPublicMusic(
    context: Context,
    tempM4a: File,
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
            tempM4a.inputStream().use { input ->
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
            put(MediaStore.MediaColumns.MIME_TYPE, "audio/mp4")
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
            put(MediaStore.MediaColumns.MIME_TYPE, "audio/mp4")
            put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                "${Environment.DIRECTORY_MUSIC}/BBPlayer",
            )
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        },
    ) ?: throw Exception("Failed to create public Music item for $fileName")

    try {
        resolver.openOutputStream(itemUri)?.use { outputStream ->
            tempM4a.inputStream().use { it.copyTo(outputStream) }
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
    tempM4a: File,
    track: TrackRecord?,
    context: Context,
    options: ExportOptions,
    json: Json,
) {
    if (track == null) return

    try {
        val audioFile = AudioFileIO.read(tempM4a)
        val tag = audioFile.tagOrCreateAndSetDefault

        tag.setField(FieldKey.TITLE, track.title ?: id)
        tag.setField(FieldKey.ARTIST, track.artist ?: "Unknown")
        tag.setField(FieldKey.ALBUM, track.title ?: "")

        // 封面
        val coverFile = CoverDownloadManager.getCoverFile(context, id)
        if (coverFile != null && coverFile.exists()) {
            try {
                val artwork = if (options.cropCoverArt) {
                    // 使用 Glide 加载并 centerCrop 裁剪为正方形，
                    // 能正确处理 WebP / HEIF 等各种格式及 EXIF 旋转。
                    val squareBitmap = Glide.with(context)
                        .asBitmap()
                        .load(coverFile)
                        .apply(RequestOptions().transform(CenterCrop()))
                        .submit(1200, 1200)
                        .get()
                    val tmpFile = File(context.cacheDir, "${id}_cover_sq.jpg")
                    try {
                        tmpFile.outputStream().use {
                            squareBitmap.compress(Bitmap.CompressFormat.JPEG, 90, it)
                        }
                        squareBitmap.recycle()
                        ArtworkFactory.createArtworkFromFile(tmpFile)
                    } finally {
                        tmpFile.delete()
                    }
                } else {
                    ArtworkFactory.createArtworkFromFile(coverFile)
                }
                tag.setField(artwork)
            } catch (e: Exception) {
                Log.w("OrpheusExport", "Cover embed skipped for $id: ${e.message}")
            }
        } else {
            Log.w("OrpheusExport", "Cover file not found for $id, skipping artwork embed")
        }

        // 歌词（仅在已缓存且 embedLyrics=true 时写入）
        if (options.embedLyrics) {
            writeLyrics(id, tag, options.convertToLrc, context, json)
        }

        audioFile.commit()
    } catch (e: Exception) {
        Log.e("OrpheusExport", "Failed to write metadata for $id: ${e.message}")
    }
}

// ─────────────────────────────────────────────────────────────
// 歌词写入（文件级私有）
// ─────────────────────────────────────────────────────────────

private fun writeLyrics(
    id: String,
    tag: org.jaudiotagger.tag.Tag,
    convertToLrc: Boolean,
    context: Context,
    json: Json,
) {
    try {
        val lyricsDir = File(context.filesDir, "lyrics")
        val lyricFile = File(lyricsDir, "${id.replace("::", "--")}.json")
        Log.d("OrpheusExport", "Checking lyrics file: $lyricFile")
        if (!lyricFile.exists()) return

        val lyricJson = lyricFile.readText()
        val lrcContent0 = json.decodeFromString<LyricFileCache>(lyricJson).lrc
        if (lrcContent0 == null) {
            Log.w("OrpheusExport", "No 'lrc' field found in lyrics JSON for $id")
            return
        }
        Log.d("OrpheusExport", "Extracted lyrics: ${lrcContent0.take(100)}")

        var lrcContent = lrcContent0

        if (convertToLrc) {
            lrcContent = SplConverter.toStandardLrc(lrcContent)
        }

        tag.setField(FieldKey.LYRICS, lrcContent)
    } catch (e: Exception) {
        Log.e("OrpheusExport", "Failed to embed lyrics for $id: ${e.message}")
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
    return if (safeName.isEmpty()) "$id.m4a" else "$safeName.m4a"
}
