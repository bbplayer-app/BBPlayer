package expo.modules.orpheus.util

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadIndex
import expo.modules.orpheus.manager.CoverDownloadManager
import expo.modules.orpheus.model.TrackRecord
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
)


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
    val pickedDir = DocumentFile.fromTreeUri(context, treeUri)

    if (pickedDir == null || !pickedDir.canWrite()) {
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
    pickedDir: DocumentFile,
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
        dataSource.open(dataSpec)
        tempM4a.outputStream().use { outputStream ->
            val buffer = ByteArray(64 * 1024)
            var bytesRead: Int
            while (dataSource.read(buffer, 0, buffer.size).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
            }
        }
        dataSource.close()

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
        )

        // 4. 拷贝到 SAF 目标路径
        val fileName = buildFileName(id, download, track, options.filenamePattern)
        val newFile = pickedDir.createFile("audio/mp4", fileName)
        if (newFile != null) {
            context.contentResolver.openOutputStream(newFile.uri)?.use { outputStream ->
                tempM4a.inputStream().use { it.copyTo(outputStream) }
            }
        }

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
                "status" to "error",
                "message" to e.message,
            )
        )
    } finally {
        tempM4a?.delete()
        try {
            dataSource.close()
        } catch (_: Exception) {
        }
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
            tag.setField(ArtworkFactory.createArtworkFromFile(coverFile))
        }

        // 歌词（仅在已缓存且 embedLyrics=true 时写入）
        if (options.embedLyrics) {
            writeLyrics(id, tempM4a, tag, options.convertToLrc, context)
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
    tempM4a: File,
    tag: org.jaudiotagger.tag.Tag,
    convertToLrc: Boolean,
    context: Context,
) {
    try {
        val lyricsDir = File(context.filesDir, "lyrics")
        val lyricFile = File(lyricsDir, "${id.replace("::", "--")}.json")
        if (!lyricFile.exists()) return

        val lyricJson = lyricFile.readText()
        val lrcMatch = Regex(
            "\"lrc\"\\s*:\\s*\"(.*?)\"(?:,|})",
            RegexOption.DOT_MATCHES_ALL,
        ).find(lyricJson) ?: return

        var lrcContent = lrcMatch.groupValues[1]
            .replace("\\n", "\n")
            .replace("\\\"", "\"")

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
