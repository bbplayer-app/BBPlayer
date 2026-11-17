const configPlugins = require('expo/config-plugins')

const { withAppBuildGradle } = configPlugins

// @sentry/react-native/expo 生成的 sentry 配置里写死了这一段
const DISABLED_TRACING_BLOCK =
	/tracingInstrumentation \{\s*enabled = false\s*\}/

const LOGCAT_TRACING_BLOCK = `tracingInstrumentation {
          enabled = true
          // 只要 Logcat 插桩，不要 OkHttp、数据库、文件 IO 等性能插桩
          features = []
          logcat {
              enabled = true
              minLevel = io.sentry.android.gradle.instrumentation.logcat.LogcatLevel.WARNING
          }
          appStart {
              enabled = false
          }
      }`

/**
 * 开启 Sentry Android Gradle Plugin 的 Logcat 插桩：编译时把 App 和所有依赖库里的
 * `android.util.Log` 调用改写为同时上报 Sentry 日志与 breadcrumb，原样输出到 logcat 的行为不变。
 *
 * 必须在 app.config 的 plugins 里排在 `@sentry/react-native/expo` 之前：
 * 后注册的 mod 先执行，排在前面才能改到 Sentry 插件已经写入的配置。
 */
const withSentryLogcat = (config) =>
	withAppBuildGradle(config, (config) => {
		const contents = config.modResults.contents

		if (!DISABLED_TRACING_BLOCK.test(contents)) {
			throw new Error(
				'withSentryLogcat: 没有找到 Sentry 插件生成的 tracingInstrumentation 配置，请检查插件顺序或 @sentry/react-native 版本',
			)
		}

		config.modResults.contents = contents.replace(
			DISABLED_TRACING_BLOCK,
			LOGCAT_TRACING_BLOCK,
		)

		return config
	})

module.exports = withSentryLogcat
