const fs = require('fs')
const path = require('path')

const {
	AndroidConfig,
	withAndroidManifest,
	withDangerousMod,
} = require('expo/config-plugins')

const BANNER_RESOURCE = 'tv_banner'
const LEANBACK_LAUNCHER = 'android.intent.category.LEANBACK_LAUNCHER'

/**
 * 让 App 出现在 Android TV / Google TV 的桌面上：
 * - 主 Activity 的启动 intent-filter 加上 LEANBACK_LAUNCHER
 * - 电视没有的硬件声明为非必需（手机照常安装）：触摸屏、竖屏（锁定竖屏会隐含要求它）、
 *   麦克风（录音权限会隐含要求它），以及 leanback 本身
 * - TV 桌面用的横幅图（320×180）
 */
const withAndroidTv = (config, { banner } = {}) => {
	config = withAndroidManifest(config, (config) => {
		const manifest = config.modResults.manifest

		manifest['uses-feature'] ??= []
		for (const name of [
			'android.software.leanback',
			'android.hardware.touchscreen',
			'android.hardware.screen.portrait',
			'android.hardware.microphone',
		]) {
			const feature = manifest['uses-feature'].find(
				(item) => item.$['android:name'] === name,
			)
			if (feature) {
				feature.$['android:required'] = 'false'
			} else {
				manifest['uses-feature'].push({
					$: { 'android:name': name, 'android:required': 'false' },
				})
			}
		}

		if (banner) {
			const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
				config.modResults,
			)
			application.$['android:banner'] = `@drawable/${BANNER_RESOURCE}`
		}

		const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
			config.modResults,
		)
		const launcherFilter = activity['intent-filter']?.find(
			(filter) =>
				filter.action?.some(
					(action) => action.$['android:name'] === 'android.intent.action.MAIN',
				) &&
				filter.category?.some(
					(category) =>
						category.$['android:name'] === 'android.intent.category.LAUNCHER',
				),
		)
		if (!launcherFilter) {
			throw new Error(
				'withAndroidTv: main activity has no launcher intent-filter',
			)
		}
		if (
			!launcherFilter.category.some(
				(category) => category.$['android:name'] === LEANBACK_LAUNCHER,
			)
		) {
			launcherFilter.category.push({ $: { 'android:name': LEANBACK_LAUNCHER } })
		}

		return config
	})

	if (banner) {
		config = withDangerousMod(config, [
			'android',
			async (config) => {
				const source = path.resolve(config.modRequest.projectRoot, banner)
				const drawableDir = path.join(
					config.modRequest.platformProjectRoot,
					'app/src/main/res/drawable-xhdpi',
				)
				await fs.promises.mkdir(drawableDir, { recursive: true })
				await fs.promises.copyFile(
					source,
					path.join(drawableDir, `${BANNER_RESOURCE}.png`),
				)
				return config
			},
		])
	}

	return config
}

module.exports = withAndroidTv
