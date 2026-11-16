package expo.modules.bbplayernative

import expo.modules.bbplayernative.telemetry.NativeLog

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Process
import android.os.SystemClock
import android.provider.MediaStore
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.bbplayernative.telemetry.NativeTelemetry
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.zip.ZipInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class BBPlayerNativeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BBPlayerNative")

        Constant("apkSigningCertificateSha256") {
            apkSigningCertificateSha256
        }

        AsyncFunction("canRequestPackageInstallsAsync") Coroutine { ->
            requireContext().packageManager.canRequestPackageInstalls()
        }

        AsyncFunction("getSupportedAbisAsync") Coroutine { ->
            return@Coroutine Build.SUPPORTED_ABIS.toList()
        }

        AsyncFunction("getStorageUsageAsync") Coroutine { ->
            withContext(Dispatchers.IO) { AppStorage.getUsage(requireContext()) }
        }

        AsyncFunction("clearCacheAsync") Coroutine { ->
            withContext(Dispatchers.IO) { AppStorage.clearCache(requireContext()) }
            NativeLog.info(LogTags.STORAGE, "storage.cache.cleared")
        }

        AsyncFunction("listStorageDirectoryAsync") Coroutine { path: String ->
            withContext(Dispatchers.IO) { AppStorage.listDirectory(requireContext(), path) }
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
            NativeLog.info(
                LogTags.UPDATE,
                "update.apk.download_enqueued",
                mapOf(
                    "download.id" to downloadId,
                    "http.host" to Uri.parse(options.url).host,
                ),
            )
            val downloadedUri = try {
                waitForDownload(downloadManager, downloadId)
            } catch (e: Exception) {
                NativeLog.error(LogTags.UPDATE, "update.apk.download_failed", mapOf("download.id" to downloadId), e)
                throw e
            }
            NativeLog.info(LogTags.UPDATE, "update.apk.downloaded", mapOf("download.id" to downloadId))
            withContext(Dispatchers.Main) {
                openApkInstaller(context, downloadedUri)
            }

            return@Coroutine AppUpdateInstallResult().apply {
                this.downloadId = downloadId
                this.uri = downloadedUri.toString()
            }
        }


        AsyncFunction("unzipAsync") Coroutine { options: UnzipOptions ->
            withContext(Dispatchers.IO) {
                try {
                    unzip(options).also { NativeLog.info(
                        LogTags.STORAGE,
                        "storage.unzip.completed",
                        mapOf(
                            "storage.file_count" to it.fileCount,
                        ),
                    ) }
                } catch (e: Exception) {
                    NativeLog.warning(LogTags.STORAGE, "storage.unzip.failed", error = e)
                    throw e
                }
            }
        }

        // JS 在 Sentry.init 之前调用，让启动阶段的事件和日志也带上同一个 user.id
        Function("getSentryInstallationId") {
            NativeTelemetry.installationId(requireContext())
        }

        // JS 的 Sentry.init 完成原生初始化后调用，返回 Sentry 的匿名安装 ID
        Function("installNativeTelemetry") { enabled: Boolean ->
            NativeTelemetry.install(enabled)
        }

        Function("setNativeTelemetryEnabled") { enabled: Boolean ->
            NativeTelemetry.updateEnabled(enabled)
        }

        // 测试页使用：输出几条结构化原生日志，并由原生 SDK 上报一个异常，
        // 用来验证结构化字段、脱敏、限流和 orpheus context 是否生效
        Function("debugTriggerNativeError") {
            NativeLog.info(LogTags.TELEMETRY, "telemetry.native.info", mapOf("telemetry.sample_id" to "native-info"))
            NativeLog.warning(
                LogTags.TELEMETRY,
                "telemetry.native.warning",
                mapOf(
                    "telemetry.sample_id" to "native-warning",
                ),
            )
            NativeLog.error(
                LogTags.TELEMETRY,
                "telemetry.native.error",
                mapOf(
                    "telemetry.sample_id" to "native-error",
                ),
                IllegalStateException("测试原生日志异常"),
            )
            io.sentry.Sentry.captureException(IllegalStateException("BBPlayer 测试原生异常 access_key=abcdef"))
        }

        // 与 expo-app-metrics 同一时钟（uptimeMillis），便于和它的启动指标对齐
        Function("getMillisSinceProcessStart") {
            SystemClock.uptimeMillis() - Process.getStartUptimeMillis()
        }

        Function("exportBackupToDownloads") { sourceUri: String, fileName: String, mimeType: String ->
            val context = requireContext()
            val uri = android.net.Uri.parse(sourceUri)
            val inputStream = context.contentResolver.openInputStream(uri)
                ?: run {
                    NativeLog.warning(LogTags.STORAGE, "backup.export.source_unreadable")
                    return@Function null
                }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/bbplayer-backup")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val downloadUri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: run {
                        NativeLog.warning(LogTags.STORAGE, "backup.export.insert_failed")
                        return@Function null
                    }
                context.contentResolver.openOutputStream(downloadUri)?.use { out ->
                    inputStream.use { it.copyTo(out) }
                }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                context.contentResolver.update(downloadUri, values, null, null)
                downloadUri.toString()
            } else {
                val subDir = java.io.File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    "bbplayer-backup",
                )
                subDir.mkdirs()
                val destFile = java.io.File(subDir, fileName)
                inputStream.use { input ->
                    java.io.FileOutputStream(destFile).use { output ->
                        input.copyTo(output)
                    }
                }
                android.net.Uri.fromFile(destFile).toString()
            }
        }
    }

    private fun requireContext(): Context =
        appContext.reactContext ?: throw IllegalStateException("React context is not available")

    /**
     * 当前 APK 签名证书的 SHA-256 指纹（小写十六进制）。
     *
     * 用于 Sentry 判断是否为官方签名构建：仓库开源、DSN 随包分发，无法阻止
     * 别人故意滥用，但可以据此挡掉「用自己的密钥重新签名后重新构建」的包。
     * 取不到时返回空串（例如 Expo Go），由 JS 侧决定如何处理。首次访问时
     * 计算一次。
     */
    @Suppress("DEPRECATION")
    private val apkSigningCertificateSha256: String by lazy {
        runCatching {
            val context = requireContext()
            val signature = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager
                    .getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                    .signingInfo
                    ?.apkContentsSigners
                    ?.firstOrNull()
            } else {
                context.packageManager
                    .getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
                    .signatures
                    ?.firstOrNull()
            }

            signature
                ?.let { MessageDigest.getInstance("SHA-256").digest(it.toByteArray()) }
                ?.joinToString("") { byte -> "%02x".format(byte.toInt() and 0xFF) }
                ?: ""
        }.getOrElse { error ->
            // 取不到时 JS 侧会把它当作非官方构建，Sentry 不会启用
            NativeLog.warning(LogTags.TELEMETRY, "telemetry.signature.unavailable", error = error)
            ""
        }
    }

    private fun ensureCanRequestPackageInstalls(context: Context) {
        if (context.packageManager.canRequestPackageInstalls()) return

        openPackageInstallerSettings(context)
        throw IllegalStateException("需要先允许 BBPlayer 安装未知来源应用")
    }

    private fun openPackageInstallerSettings(context: Context) {
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


    private fun unzip(options: UnzipOptions): UnzipResult {
        if (options.inputUri.isBlank()) {
            throw IllegalArgumentException("ZIP 输入路径不能为空")
        }
        if (options.outputUri.isBlank()) {
            throw IllegalArgumentException("ZIP 输出目录不能为空")
        }

        val inputFile = fileFromUri(options.inputUri)
        val outputDirectory = fileFromUri(options.outputUri)
        if (outputDirectory.exists()) {
            outputDirectory.deleteRecursively()
        }
        outputDirectory.mkdirs()

        val outputCanonicalPath = outputDirectory.canonicalPath
        var fileCount = 0

        ZipInputStream(FileInputStream(inputFile)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val outputFile = File(outputDirectory, entry.name)
                val outputFileCanonicalPath = outputFile.canonicalPath

                if (!outputFileCanonicalPath.startsWith(outputCanonicalPath + File.separator)) {
                    throw IllegalArgumentException("ZIP 包含非法路径：${entry.name}")
                }

                if (entry.isDirectory) {
                    outputFile.mkdirs()
                } else {
                    outputFile.parentFile?.mkdirs()
                    FileOutputStream(outputFile).use { stream ->
                        zip.copyTo(stream)
                    }
                    fileCount += 1
                }
                zip.closeEntry()
            }
        }

        return UnzipResult().apply {
            this.uri = Uri.fromFile(outputDirectory).toString()
            this.fileCount = fileCount
        }
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
    companion object {
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        private const val DOWNLOAD_POLL_INTERVAL_MS = 1_000L
    }
}

@OptimizedRecord
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

@OptimizedRecord
class UnzipOptions : Record {
    @Field
    var inputUri: String = ""

    @Field
    var outputUri: String = ""
}

@OptimizedRecord
class AppUpdateInstallResult : Record {
    @Field
    var downloadId: Long = 0

    @Field
    var uri: String = ""
}

@OptimizedRecord
class UnzipResult : Record {
    @Field
    var uri: String = ""

    @Field
    var fileCount: Int = 0
}



