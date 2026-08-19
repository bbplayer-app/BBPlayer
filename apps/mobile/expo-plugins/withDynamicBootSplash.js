const fs = require('fs/promises')
const path = require('path')

const { withFinalizedMod } = require('expo/config-plugins')

const withDynamicAndroidBootSplash = (config) =>
	withFinalizedMod(config, [
		'android',
		async (config) => {
			const stylesPath = path.join(
				config.modRequest.platformProjectRoot,
				'app/src/main/res/values/styles.xml',
			)
			let styles = await fs.readFile(stylesPath, 'utf8')
			styles = styles.replace(
				/^\s*<item name="bootSplashBackground">.*<\/item>\s*$/m,
				'',
			)

			if (styles.includes('bootSplashBackground')) {
				throw new Error('Unable to make the Android BootSplash theme-aware')
			}

			await fs.writeFile(stylesPath, styles)
			return config
		},
	])

const withDynamicIosBootSplash = (config) =>
	withFinalizedMod(config, [
		'ios',
		async (config) => {
			const storyboardPath = path.join(
				config.modRequest.platformProjectRoot,
				config.modRequest.projectName,
				'BootSplash.storyboard',
			)
			let storyboard = await fs.readFile(storyboardPath, 'utf8')

			storyboard = storyboard.replace(
				/<color key="backgroundColor" name="BootSplashBackground-[^"]+"\/>/,
				'<color key="backgroundColor" systemColor="systemBackgroundColor"/>',
			)
			storyboard = storyboard.replace(
				/<namedColor name="BootSplashBackground-[^"]+">[\s\S]*?<\/namedColor>/,
				`<systemColor name="systemBackgroundColor">
            <color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>
        </systemColor>`,
			)

			if (!storyboard.includes('systemColor="systemBackgroundColor"')) {
				throw new Error('Unable to make BootSplash.storyboard theme-aware')
			}

			await fs.writeFile(storyboardPath, storyboard)
			return config
		},
	])

const withDynamicBootSplash = (config) => {
	config = withDynamicAndroidBootSplash(config)
	config = withDynamicIosBootSplash(config)
	return config
}

module.exports = withDynamicBootSplash
