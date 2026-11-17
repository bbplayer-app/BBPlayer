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
import io.sentry.android.core.SentryAndroidOptions
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

    /** 最近一次开启采集的时间（秒），跨过关闭期间的 transaction 一律丢弃 */
    @Volatile
    private var enabledSinceSeconds = 0.0

    /** 关闭采集时暂存的 release，见 [updateEnabled] */
    private var suspendedRelease: String? = null

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

    /**
     * 开启原生侧 tracing，让原生发起的请求（如播放器解析音频地址）也能产生 span。
     *
     * RN SDK 初始化时把原生 tracesSampleRate 置空，避免和 JS 重复采集导航 span。这里在初始化之后再改写：
     * Activity 生命周期、帧率等自动 tracing 在注册时就判断过 tracing 是否开启，之后再打开不会让它们生效，
     * 只影响手动创建的 transaction。数据采集开关仍由 beforeSendTransaction 拦截。
     * 这依赖 SDK 内部行为，升级 Sentry 时按 packages/orpheus/docs/Native-Tracing.md 检查。
     */
    fun setTracesSampleRate(rate: Double) {
        if (!Sentry.isEnabled()) return
        val options = ScopesAdapter.getInstance().options
        // 手势 tracing 是每次手势时才判断的，显式关掉，避免和 JS 的点击 transaction 重复
        (options as? SentryAndroidOptions)?.isEnableUserInteractionTracing = false
        options.tracesSampleRate = rate
    }

    @Synchronized
    fun updateEnabled(enabled: Boolean) {
        if (enabled && !isEnabled) enabledSinceSeconds = System.currentTimeMillis() / 1000.0
        isEnabled = enabled
        if (!installed || !Sentry.isEnabled()) return
        val options = ScopesAdapter.getInstance().options
        options.logs.isEnabled = enabled
        suspendSessions(options, !enabled)
    }

    /**
     * 自动会话由 LifecycleWatcher 直接发送，不经过任何 before* 回调，开关只能在这里拦。
     * 关闭时丢弃当前会话（不发送结束），并清空 release：没有 release 时 SDK 不会开始新会话。
     * 这依赖 SDK 内部行为，升级 Sentry 时按 packages/orpheus/docs/Native-Tracing.md 检查。
     */
    private fun suspendSessions(options: SentryOptions, suspend: Boolean) {
        if (suspend) {
            if (suspendedRelease == null) suspendedRelease = options.release
            options.release = null
            Sentry.configureScope { it.clearSession() }
        } else if (suspendedRelease != null) {
            options.release = suspendedRelease
            suspendedRelease = null
            Sentry.startSession()
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
            // orpheus 等自定义 context 是普通 Map（如 lastAudioError 是原始异常文本），Device、OS 这类内置 context 不是
            val contexts = event.contexts
            for ((key, value) in contexts.entrySet().toList()) {
                if (value is Map<*, *>) contexts.put(key, scrubMap(value))
            }
            // 原回调返回 null 表示丢弃，不能用 ?: 退回原事件
            if (previousBeforeSend != null) previousBeforeSend.execute(event, hint) else event
        }

        val previousBeforeSendTransaction = options.beforeSendTransaction
        options.setBeforeSendTransaction { transaction, hint ->
            if (!isEnabled) return@setBeforeSendTransaction null
            // 关闭期间开始、重新开启后才结束的 transaction 带着关闭期间的数据
            if ((transaction.startTimestamp ?: 0.0) < enabledSinceSeconds) return@setBeforeSendTransaction null
            if (previousBeforeSendTransaction != null) {
                previousBeforeSendTransaction.execute(transaction, hint)
            } else {
                transaction
            }
        }

        val previousBeforeBreadcrumb = options.beforeBreadcrumb
        options.setBeforeBreadcrumb { breadcrumb, hint ->
            // 关闭期间的 breadcrumb 不能留到重新开启后的事件里
            if (!isEnabled) return@setBeforeBreadcrumb null
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
            // error.message 等属性由 NativeLog 自动附带，调用方控制不了内容
            log.attributes?.entries?.toList()?.forEach { (key, attribute) ->
                val value = attribute.value
                if (value is String) {
                    log.setAttribute(key, SentryLogEventAttributeValue(attribute.type, TelemetryScrubber.scrub(value)))
                }
            }
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

    private fun scrubMap(map: Map<*, *>): Map<String, Any?> = map.entries.associate { (key, value) ->
        key.toString() to when (value) {
            is String -> TelemetryScrubber.scrub(value)
            is Map<*, *> -> scrubMap(value)
            else -> value
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
