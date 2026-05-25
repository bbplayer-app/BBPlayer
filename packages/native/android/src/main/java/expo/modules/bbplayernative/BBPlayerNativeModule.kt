package expo.modules.bbplayernative

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.squareup.gifencoder.GifEncoder
import com.squareup.gifencoder.ImageOptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import java.util.zip.InflaterInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class BBPlayerNativeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BBPlayerNative")

        AsyncFunction("canRequestPackageInstallsAsync") Coroutine { ->
            val context = requireContext()
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return@Coroutine true
            }
            return@Coroutine context.packageManager.canRequestPackageInstalls()
        }

        AsyncFunction("getSupportedAbisAsync") Coroutine { ->
            return@Coroutine Build.SUPPORTED_ABIS.toList()
        }

        AsyncFunction("openPackageInstallerSettingsAsync") {
            val context = requireContext()
            openPackageInstallerSettings(context)
        }

        AsyncFunction("downloadAndInstallApkAsync") Coroutine { options: AppUpdateDownloadOptions ->
            val context = requireContext()
            ensureCanRequestPackageInstalls(context)

            val downloadManager =
                context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val downloadId = enqueueApkDownload(context, downloadManager, options)
            val downloadedUri = waitForDownload(downloadManager, downloadId)
            withContext(Dispatchers.Main) {
                openApkInstaller(context, downloadedUri)
            }

            return@Coroutine mapOf(
                "downloadId" to downloadId.toDouble(),
                "uri" to downloadedUri.toString(),
            )
        }

        AsyncFunction("convertSvgaBinToGifAsync") Coroutine { options: SvgaToGifOptions ->
            val context = requireContext()
            val result = withContext(Dispatchers.IO) {
                convertSvgaBinToGif(context, options)
            }

            return@Coroutine mapOf(
                "uri" to result.uri,
                "width" to result.width,
                "height" to result.height,
                "frames" to result.frames,
                "fps" to result.fps,
            )
        }
    }

    private fun requireContext(): Context =
        appContext.reactContext ?: throw IllegalStateException("React context is not available")

    private fun ensureCanRequestPackageInstalls(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (context.packageManager.canRequestPackageInstalls()) return

        openPackageInstallerSettings(context)
        throw IllegalStateException("需要先允许 BBPlayer 安装未知来源应用")
    }

    private fun openPackageInstallerSettings(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${context.packageName}"),
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun enqueueApkDownload(
        context: Context,
        downloadManager: DownloadManager,
        options: AppUpdateDownloadOptions,
    ): Long {
        if (options.url.isBlank()) {
            throw IllegalArgumentException("更新包下载链接不能为空")
        }

        val fileName = sanitizeApkFileName(options.fileName)
        val title = options.title?.takeIf { it.isNotBlank() } ?: "BBPlayer 更新包"
        val description =
            options.description?.takeIf { it.isNotBlank() } ?: "下载完成后将打开系统安装器"

        val request = DownloadManager.Request(Uri.parse(options.url)).apply {
            setTitle(title)
            setDescription(description)
            setMimeType(APK_MIME_TYPE)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            addRequestHeader("User-Agent", context.packageName)
        }

        return downloadManager.enqueue(request)
    }

    private suspend fun waitForDownload(
        downloadManager: DownloadManager,
        downloadId: Long,
    ): Uri = withContext(Dispatchers.IO) {
        var downloadedUri: Uri? = null

        while (downloadedUri == null) {
            val query = DownloadManager.Query().setFilterById(downloadId)
            val cursor = downloadManager.query(query)
                ?: throw IllegalStateException("无法查询更新包下载状态")

            cursor.use {
                if (!it.moveToFirst()) {
                    throw IllegalStateException("更新包下载任务不存在")
                }

                when (it.getIntColumn(DownloadManager.COLUMN_STATUS)) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        downloadedUri = downloadManager.getUriForDownloadedFile(downloadId)
                            ?: throw IllegalStateException("更新包下载完成，但无法获取文件地址")
                    }

                    DownloadManager.STATUS_FAILED -> {
                        val reason = it.getIntColumn(DownloadManager.COLUMN_REASON)
                        throw IllegalStateException("更新包下载失败，错误码 $reason")
                    }
                }
            }

            if (downloadedUri == null) {
                delay(DOWNLOAD_POLL_INTERVAL_MS)
            }
        }

        return@withContext downloadedUri
            ?: throw IllegalStateException("更新包下载完成，但无法获取文件地址")
    }

    private fun openApkInstaller(context: Context, apkUri: Uri) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, APK_MIME_TYPE)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        if (intent.resolveActivity(context.packageManager) == null) {
            throw IllegalStateException("系统中没有可用的 APK 安装器")
        }

        context.startActivity(intent)
    }

    private fun Cursor.getIntColumn(columnName: String): Int =
        getInt(getColumnIndexOrThrow(columnName))

    private fun sanitizeApkFileName(fileName: String?): String {
        val normalized = fileName
            ?.takeIf { it.isNotBlank() }
            ?.replace(Regex("[^A-Za-z0-9._-]"), "_")
            ?: "BBPlayer-update-${System.currentTimeMillis()}.apk"

        return if (normalized.endsWith(".apk", ignoreCase = true)) {
            normalized
        } else {
            "$normalized.apk"
        }
    }

    private fun convertSvgaBinToGif(
        context: Context,
        options: SvgaToGifOptions,
    ): SvgaToGifResult {
        if (options.inputUri.isBlank()) {
            throw IllegalArgumentException("SVGA 输入路径不能为空")
        }
        if (options.outputUri.isBlank()) {
            throw IllegalArgumentException("GIF 输出路径不能为空")
        }

        val input = readUriBytes(context, options.inputUri)
        val movie = SvgaMovieParser.parse(inflateZlib(input))
        val width = options.width ?: movie.width
        val height = options.height ?: movie.height
        val delayMs = 1_000L / movie.fps.coerceAtLeast(1)
        val frames = movie.renderFrames(width, height)
        val outputFile = fileFromUri(options.outputUri)
        outputFile.parentFile?.mkdirs()

        FileOutputStream(outputFile).use { stream ->
            val encoder = GifEncoder(stream, width, height, 0)
            val imageOptions = ImageOptions().apply {
                setDelay(delayMs, TimeUnit.MILLISECONDS)
            }

            for (frame in frames) {
                encoder.addImage(frame.toRgbArray(), imageOptions)
                frame.recycle()
            }

            encoder.finishEncoding()
        }

        return SvgaToGifResult(
            uri = Uri.fromFile(outputFile).toString(),
            width = width,
            height = height,
            frames = movie.frameCount,
            fps = movie.fps,
        )
    }

    private fun readUriBytes(context: Context, uri: String): ByteArray {
        val parsed = Uri.parse(uri)
        return when (parsed.scheme) {
            "file" -> File(parsed.path ?: throw IllegalArgumentException("无效文件路径")).readBytes()
            "content" -> context.contentResolver.openInputStream(parsed)?.use { it.readBytes() }
                ?: throw IllegalArgumentException("无法读取输入文件")
            null -> File(uri).readBytes()
            else -> throw IllegalArgumentException("不支持的输入路径协议：${parsed.scheme}")
        }
    }

    private fun fileFromUri(uri: String): File {
        val parsed = Uri.parse(uri)
        return when (parsed.scheme) {
            "file" -> File(parsed.path ?: throw IllegalArgumentException("无效输出路径"))
            null -> File(uri)
            else -> throw IllegalArgumentException("GIF 输出路径必须是 file URI 或本地路径")
        }
    }

    private fun inflateZlib(input: ByteArray): ByteArray =
        InflaterInputStream(ByteArrayInputStream(input)).use { stream ->
            stream.readBytes()
        }

    companion object {
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        private const val DOWNLOAD_POLL_INTERVAL_MS = 1_000L
    }
}

class AppUpdateDownloadOptions : Record {
    @Field
    var url: String = ""

    @Field
    var fileName: String? = null

    @Field
    var title: String? = null

    @Field
    var description: String? = null
}

class SvgaToGifOptions : Record {
    @Field
    var inputUri: String = ""

    @Field
    var outputUri: String = ""

    @Field
    var width: Int? = null

    @Field
    var height: Int? = null
}

private data class SvgaToGifResult(
    val uri: String,
    val width: Int,
    val height: Int,
    val frames: Int,
    val fps: Int,
)

private data class SvgaMovie(
    val width: Int,
    val height: Int,
    val fps: Int,
    val frameCount: Int,
    val images: Map<String, ByteArray>,
    val sprites: List<SvgaSprite>,
) {
    fun renderFrames(targetWidth: Int, targetHeight: Int): List<Bitmap> {
        val scaleX = targetWidth / width.toFloat()
        val scaleY = targetHeight / height.toFloat()
        return List(frameCount) { frameIndex ->
            Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888).also { frame ->
                val canvas = Canvas(frame)
                for (sprite in sprites) {
                    if (!sprite.activeFrames.contains(frameIndex)) continue
                    val image = images[sprite.imageKey] ?: continue
                    val bitmap = BitmapFactory.decodeByteArray(image, 0, image.size) ?: continue
                    val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
                    canvas.drawBitmap(scaled, 0f, 0f, null)
                    if (scaled !== bitmap) scaled.recycle()
                    bitmap.recycle()
                }
            }
        }
    }
}

private data class SvgaSprite(
    val imageKey: String,
    val activeFrames: Set<Int>,
)

private object SvgaMovieParser {
    fun parse(data: ByteArray): SvgaMovie {
        val reader = ProtoReader(data)
        var width = 0
        var height = 0
        var fps = 20
        var frameCount = 0
        val images = linkedMapOf<String, ByteArray>()
        val sprites = mutableListOf<SvgaSprite>()

        while (!reader.isAtEnd()) {
            when (val field = reader.nextField()) {
                2 -> {
                    val params = ProtoReader(reader.readLengthDelimited())
                    while (!params.isAtEnd()) {
                        when (params.nextField()) {
                            1 -> width = params.readFloat().toInt()
                            2 -> height = params.readFloat().toInt()
                            3 -> fps = params.readVarint().toInt()
                            4 -> frameCount = params.readVarint().toInt()
                            else -> params.skipLast()
                        }
                    }
                }
                3 -> {
                    val entry = ProtoReader(reader.readLengthDelimited())
                    var key = ""
                    var value = ByteArray(0)
                    while (!entry.isAtEnd()) {
                        when (entry.nextField()) {
                            1 -> key = entry.readString()
                            2 -> value = entry.readLengthDelimited()
                            else -> entry.skipLast()
                        }
                    }
                    if (key.isNotBlank() && value.isNotEmpty()) {
                        images[key] = value
                    }
                }
                4 -> sprites += parseSprite(reader.readLengthDelimited())
                else -> reader.skipField(field)
            }
        }

        if (width <= 0 || height <= 0 || frameCount <= 0) {
            throw IllegalArgumentException("无效的 SVGA 动画参数")
        }

        return SvgaMovie(width, height, fps, frameCount, images, sprites)
    }

    private fun parseSprite(data: ByteArray): SvgaSprite {
        val reader = ProtoReader(data)
        var imageKey = ""
        val activeFrames = mutableSetOf<Int>()
        var frameIndex = 0

        while (!reader.isAtEnd()) {
            when (reader.nextField()) {
                1 -> imageKey = reader.readString()
                2 -> {
                    if (isActiveFrame(reader.readLengthDelimited())) {
                        activeFrames += frameIndex
                    }
                    frameIndex += 1
                }
                else -> reader.skipLast()
            }
        }

        return SvgaSprite(imageKey, activeFrames)
    }

    private fun isActiveFrame(data: ByteArray): Boolean {
        val reader = ProtoReader(data)
        var alpha = 0f
        var hasLayout = false

        while (!reader.isAtEnd()) {
            when (reader.nextField()) {
                1 -> alpha = reader.readFloat()
                2 -> {
                    reader.readLengthDelimited()
                    hasLayout = true
                }
                else -> reader.skipLast()
            }
        }

        return alpha > 0f && hasLayout
    }
}

private class ProtoReader(private val data: ByteArray) {
    private var position = 0
    private var lastWireType = 0

    fun isAtEnd(): Boolean = position >= data.size

    fun nextField(): Int {
        val tag = readVarint().toInt()
        lastWireType = tag and 0x07
        return tag ushr 3
    }

    fun readVarint(): Long {
        var shift = 0
        var result = 0L
        while (shift < 64) {
            val byte = data[position++].toInt() and 0xff
            result = result or ((byte and 0x7f).toLong() shl shift)
            if ((byte and 0x80) == 0) return result
            shift += 7
        }
        throw IllegalArgumentException("无效的 protobuf varint")
    }

    fun readFloat(): Float {
        val value = ByteBuffer.wrap(data, position, 4)
            .order(ByteOrder.LITTLE_ENDIAN)
            .float
        position += 4
        return value
    }

    fun readString(): String = readLengthDelimited().toString(Charsets.UTF_8)

    fun readLengthDelimited(): ByteArray {
        val length = readVarint().toInt()
        val bytes = data.copyOfRange(position, position + length)
        position += length
        return bytes
    }

    fun skipLast() {
        skipWireType(lastWireType)
    }

    fun skipField(@Suppress("UNUSED_PARAMETER") field: Int) {
        skipLast()
    }

    private fun skipWireType(wireType: Int) {
        when (wireType) {
            0 -> readVarint()
            1 -> position += 8
            2 -> position += readVarint().toInt()
            5 -> position += 4
            else -> throw IllegalArgumentException("不支持的 protobuf wire type: $wireType")
        }
    }
}

private fun Bitmap.toRgbArray(): Array<IntArray> =
    Array(height) { y ->
        IntArray(width) { x ->
            getPixel(x, y)
        }
    }
