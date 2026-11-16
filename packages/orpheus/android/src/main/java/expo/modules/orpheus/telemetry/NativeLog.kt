package expo.modules.orpheus.telemetry

import android.util.Log
import io.sentry.Breadcrumb
import io.sentry.Sentry
import io.sentry.SentryAttributes
import io.sentry.SentryLevel
import io.sentry.SentryLogLevel
import io.sentry.logger.SentryLogParameters

/**
 * 只用于关键播放故障。调用方负责选择诊断字段并处理敏感信息，
 * 此处只组装日志；限流和用户开关沿用 NativeTelemetry。
 */
internal object NativeLog {
    fun warning(tag: String, event: String, fields: Map<String, Any?>, error: Throwable? = null) =
        write(SentryLogLevel.WARN, tag, event, fields, error)

    fun error(tag: String, event: String, fields: Map<String, Any?>, error: Throwable) =
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
        // Sentry Gradle 插件只插桩 v/d/i/w/e/wtf，不插桩 println。
        // 本地保留同一条日志和堆栈，避免再自动上报一份没有结构化属性的副本。
        Log.println(if (level == SentryLogLevel.ERROR) Log.ERROR else Log.WARN, tag, localMessage)

        Sentry.logger().log(level, SentryLogParameters.create(SentryAttributes.fromMap(attributes)), event)
        Sentry.addBreadcrumb(Breadcrumb().apply {
            category = "Logcat"
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
