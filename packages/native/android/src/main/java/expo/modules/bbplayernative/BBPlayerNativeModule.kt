package expo.modules.bbplayernative

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
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
