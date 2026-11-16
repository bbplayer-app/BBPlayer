package expo.modules.bbplayernative.telemetry

import android.content.Context
import android.os.SystemClock
import io.sentry.Breadcrumb
import io.sentry.ScopesAdapter
import io.sentry.Sentry
import io.sentry.SentryAttributeType
import io.sentry.SentryLevel
import io.sentry.SentryLogEventAttributeValue
import io.sentry.SentryOptions
import io.sentry.SentryUUID
import java.io.File

/**
 * 在原生 Sentry SDK 上挂接隐私与限流处理。
 *
 * 原生 SDK 由 JS 的 `Sentry.init` 初始化，JS 传不了回调过来，所以等初始化完成后由 JS 调用 [install]，
 * 直接改写 SDK 正在使用的 options：SDK 每次上报时都会重新读取这些回调。
 * 注意：回调内不能再调用 NativeLog 或 Sentry logger，否则会递归进入自身。
 */
object NativeTelemetry {
    /** 用户的数据采集开关，中途关闭后原生侧立刻停止上报 */
    @Volatile
    var isEnabled = false

    @Volatile
    private var installed = false

    private val logRateLimiter = LogRateLimiter(perKeyLimit = 30, globalLimit = 600)

    // breadcrumb 只有 100 个位置，同一处警告刷屏会把其他记录全挤掉
    private val breadcrumbRateLimiter = LogRateLimiter(perKeyLimit = 3, globalLimit = 30)

    /**
     * 挂接回调并按开关决定是否开启原生日志。返回 Sentry 的匿名安装 ID，原生 SDK 未初始化时返回 null。
     */
    @Synchronized
    fun install(enabled: Boolean): String? {
        isEnabled = enabled
        if (!Sentry.isEnabled()) return null
        val options = ScopesAdapter.getInstance().options
        if (!installed) {
            installed = true
            wrapCallbacks(options)
        }
        // 原生日志在回调挂好之后才开启，初始化到现在这段时间的日志不会未经处理就发出去
        options.logs.isEnabled = enabled
        return options.distinctId
    }

    /**
     * Sentry 的匿名安装 ID。与 sentry-android 的 `Installation.id` 读写同一个文件、同样的格式，
     * 所以可以在原生 SDK 初始化之前取到，JS 用它让启动阶段的日志也带上 user.id。
     */
    @Synchronized
    fun installationId(context: Context): String? = runCatching {
        val file = File(context.filesDir, INSTALLATION_FILE)
        if (file.exists()) {
            file.readText().trim().ifEmpty { null }
        } else {
            SentryUUID.generateSentryId().also(file::writeText)
        }
    }.getOrNull()

    fun updateEnabled(enabled: Boolean) {
        isEnabled = enabled
        if (installed && Sentry.isEnabled()) {
            ScopesAdapter.getInstance().options.logs.isEnabled = enabled
        }
    }

    private fun wrapCallbacks(options: SentryOptions) {
        val previousBeforeSend = options.beforeSend
        options.setBeforeSend { event, hint ->
            if (!isEnabled) return@setBeforeSend null
            event.message?.let { message ->
                message.formatted = TelemetryScrubber.scrubNullable(message.formatted)
                message.message = TelemetryScrubber.scrubNullable(message.message)
            }
            event.exceptions?.forEach { it.value = TelemetryScrubber.scrubNullable(it.value) }
            event.breadcrumbs?.forEach(::scrubBreadcrumb)
            // 原回调返回 null 表示丢弃，不能用 ?: 退回原事件
            if (previousBeforeSend != null) previousBeforeSend.execute(event, hint) else event
        }

        val previousBeforeSendTransaction = options.beforeSendTransaction
        options.setBeforeSendTransaction { transaction, hint ->
            if (!isEnabled) return@setBeforeSendTransaction null
            if (previousBeforeSendTransaction != null) {
                previousBeforeSendTransaction.execute(transaction, hint)
            } else {
                transaction
            }
        }

        val previousBeforeBreadcrumb = options.beforeBreadcrumb
        options.setBeforeBreadcrumb { breadcrumb, hint ->
            // 原生结构化日志的 breadcrumb 只留警告及以上，避免挤掉 JS 的 breadcrumb
            if (breadcrumb.category == NATIVE_LOG_CATEGORY) {
                if (breadcrumb.level.isBelowWarning()) return@setBeforeBreadcrumb null
                val dropped = breadcrumbRateLimiter.acquire(
                    breadcrumb.message.orEmpty(),
                    breadcrumb.level?.name.orEmpty(),
                    breadcrumb.data["log.tag"]?.toString().orEmpty(),
                )
                    ?: return@setBeforeBreadcrumb null
                if (dropped > 0) breadcrumb.setData("rate_limited_before", dropped)
            }
            scrubBreadcrumb(breadcrumb)
            if (previousBeforeBreadcrumb != null) previousBeforeBreadcrumb.execute(breadcrumb, hint) else breadcrumb
        }

        val previousBeforeSendLog = options.logs.beforeSend
        options.logs.setBeforeSend { log ->
            if (!isEnabled) return@setBeforeSend null
            val dropped = logRateLimiter.acquire(
                log.body,
                log.level.name,
                log.attributes?.get("log.tag")?.value?.toString().orEmpty(),
            ) ?: return@setBeforeSend null
            log.body = TelemetryScrubber.scrub(log.body)
            if (dropped > 0) {
                log.setAttribute(
                    "bbplayer.rate_limited_before",
                    SentryLogEventAttributeValue(SentryAttributeType.INTEGER, dropped),
                )
            }
            if (previousBeforeSendLog != null) previousBeforeSendLog.execute(log) else log
        }
    }

    private fun scrubBreadcrumb(breadcrumb: Breadcrumb) {
        breadcrumb.message = TelemetryScrubber.scrubNullable(breadcrumb.message)
        for ((key, value) in breadcrumb.data.entries.toList()) {
            if (value is String) breadcrumb.setData(key, TelemetryScrubber.scrub(value))
        }
    }

    private fun SentryLevel?.isBelowWarning() =
        this == null || this == SentryLevel.DEBUG || this == SentryLevel.INFO

    private const val NATIVE_LOG_CATEGORY = "native.log"

    // 与 io.sentry.android.core.Installation 使用的文件名一致
    private const val INSTALLATION_FILE = "INSTALLATION"
}

/**
 * 按完整事件名、作用域和级别桶限流。info、warning、error 独立计数，
 * 每桶每分钟最多 [globalLimit] 条，每个事件最多 [perKeyLimit] 条。
 */
private class LogRateLimiter(private val perKeyLimit: Int, private val globalLimit: Int) {
    private data class Key(val bucket: String, val scope: String, val event: String)
    private val counts = HashMap<Key, Int>()
    private val dropped = HashMap<Key, Int>()
    private var windowStartMs = SystemClock.elapsedRealtime()
    private val totals = HashMap<String, Int>()

    /** 允许发送时返回上个窗口里这类日志被丢掉的条数，不允许时返回 null */
    @Synchronized
    fun acquire(event: String, level: String, scope: String): Int? {
        val now = SystemClock.elapsedRealtime()
        if (now - windowStartMs >= WINDOW_MS) {
            windowStartMs = now
            totals.clear()
            counts.clear()
            // 只在下一条同类日志上报告，长期不再出现的就不必记着了
            if (dropped.size > KEY_LIMIT) dropped.clear()
        }
        val bucket = when (level) {
            "ERROR", "FATAL" -> "error"
            "WARN", "WARNING" -> "warning"
            else -> "info"
        }
        val key = Key(bucket, scope, event)
        val count = counts[key] ?: 0
        val total = totals[bucket] ?: 0
        if (count >= perKeyLimit || total >= globalLimit) {
            dropped[key] = (dropped[key] ?: 0) + 1
            return null
        }
        counts[key] = count + 1
        totals[bucket] = total + 1
        return dropped.remove(key) ?: 0
    }

    private companion object {
        const val WINDOW_MS = 60_000L
        const val KEY_LIMIT = 1000
    }
}
