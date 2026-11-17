const configPlugins = require('expo/config-plugins')

const { AndroidConfig, withAndroidManifest } = configPlugins

/**
 * ANR 事件附带所有线程的调用栈，用来看主线程卡在等哪个线程或哪把锁。
 *
 * RN SDK 没有暴露这个选项。sentry-android 初始化时会先读 manifest 里的 meta-data，
 * RN 只覆盖它自己设置的那些项，所以写在这里就能生效。
 */
const withSentryAnrThreadDump = (config) =>
	withAndroidManifest(config, (config) => {
		const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
			config.modResults,
		)

		AndroidConfig.Manifest.addMetaDataItemToMainApplication(
			application,
			'io.sentry.anr.attach-thread-dumps',
			'true',
		)

		return config
	})

module.exports = withSentryAnrThreadDump
