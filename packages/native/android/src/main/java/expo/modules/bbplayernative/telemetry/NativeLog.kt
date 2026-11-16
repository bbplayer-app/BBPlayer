package expo.modules.bbplayernative.telemetry

import android.util.Log
import io.sentry.Breadcrumb
import io.sentry.Sentry
import io.sentry.SentryAttributes
import io.sentry.SentryLevel
import io.sentry.SentryLogLevel
import io.sentry.logger.SentryLogParameters

/** 稳定事件名和扁平字段共用于 Logcat、Sentry Logs 与 breadcrumb。调用方负责选择安全字段。 */
object NativeLog {
    fun debug(tag: String, event: String, fields: Map<String, Any?> = emptyMap()) =
        write(SentryLogLevel.DEBUG, tag, event, fields, null)

    fun info(tag: String, event: String, fields: Map<String, Any?> = emptyMap()) =
        write(SentryLogLevel.INFO, tag, event, fields, null)

    fun warning(tag: String, event: String, fields: Map<String, Any?> = emptyMap(), error: Throwable? = null) =
        write(SentryLogLevel.WARN, tag, event, fields, error)

    fun error(tag: String, event: String, fields: Map<String, Any?> = emptyMap(), error: Throwable? = null) =
        write(SentryLogLevel.ERROR, tag, event, fields, error)

    private fun write(
        level: SentryLogLevel,
        tag: String,
        event: String,
        fields: Map<String, Any?>,
        error: Throwable?,
    ) {
        val attributes = attributesFor(tag, fields, error)
        val localMessage = buildString {
            append(event)
            attributes.forEach { (key, value) -> append(" $key=$value") }
            if (error != null) append("\n${Log.getStackTraceString(error)}")
        }
        // 本地始终保留日志与堆栈，远端是否接受由 NativeTelemetry 独立决定。
        // 使用 println，避免意外开启 Logcat 插桩时重复上报。
        val priority = when (level) {
            SentryLogLevel.DEBUG -> Log.DEBUG
            SentryLogLevel.INFO -> Log.INFO
            SentryLogLevel.WARN -> Log.WARN
            else -> Log.ERROR
        }
        Log.println(priority, tag, localMessage)
        if (level == SentryLogLevel.DEBUG) return

        Sentry.logger().log(level, SentryLogParameters.create(SentryAttributes.fromMap(attributes)), event)
        if (level == SentryLogLevel.INFO) return
        Sentry.addBreadcrumb(Breadcrumb().apply {
            category = "native.log"
            message = event
            this.level = if (level == SentryLogLevel.ERROR) SentryLevel.ERROR else SentryLevel.WARNING
            attributes.forEach { (key, value) -> setData(key, value) }
        })
    }

    private fun attributesFor(
        tag: String,
        fields: Map<String, Any?>,
        error: Throwable?,
    ): Map<String, Any> = buildMap {
        fields.forEach { (key, value) ->
            if (value != null) put(key, value)
        }
        put("log.tag", tag)
        if (error != null) {
            put("error.type", error.javaClass.name)
            error.message?.let { put("error.message", it) }
        }
    }
}
