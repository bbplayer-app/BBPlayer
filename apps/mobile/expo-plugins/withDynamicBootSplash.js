const fs = require('fs/promises')
const path = require('path')

const { withFinalizedMod } = require('expo/config-plugins')
const bootSplashColors = require('../boot-splash-colors.json')

const upsertAndroidColor = (resources, name, value) => {
	const colorPattern = new RegExp(
		`<color\\s+name=["']${name}["'][^>]*>[^<]*<\\/color>`,
	)
	const color = `<color name="${name}">${value}</color>`

	if (colorPattern.test(resources)) {
		return resources.replace(colorPattern, color)
	}

	if (/<resources\s*\/>/.test(resources)) {
		return resources.replace(
			/<resources\s*\/>/,
			`<resources>\n  ${color}\n</resources>`,
		)
	}

	if (resources.includes('</resources>')) {
		return resources.replace('</resources>', `  ${color}\n</resources>`)
	}

	throw new Error(`Unable to update Android color resource: ${name}`)
}

const withDynamicAndroidBootSplash = (config) =>
	withFinalizedMod(config, [
		'android',
		async (config) => {
			const resourcesRoot = path.join(
				config.modRequest.platformProjectRoot,
				'app/src/main/res',
			)
			const stylesPath = path.join(resourcesRoot, 'values/styles.xml')
			const lightColorsPath = path.join(resourcesRoot, 'values/colors.xml')
			const darkColorsPath = path.join(resourcesRoot, 'values-night/colors.xml')
			const styles = await fs.readFile(stylesPath, 'utf8')

			if (
				!styles.includes(
					'<item name="bootSplashBackground">@color/bootsplash_background</item>',
				)
			) {
				throw new Error('Unable to find the Android BootSplash background')
			}

			const lightColors = upsertAndroidColor(
				await fs.readFile(lightColorsPath, 'utf8'),
				'bootsplash_background',
				bootSplashColors.light,
			)
			await fs.mkdir(path.dirname(darkColorsPath), { recursive: true })
			let darkColors
			try {
				darkColors = await fs.readFile(darkColorsPath, 'utf8')
			} catch (error) {
				if (error.code !== 'ENOENT') throw error
				darkColors = '<resources>\n</resources>\n'
			}
			darkColors = upsertAndroidColor(
				darkColors,
				'bootsplash_background',
				bootSplashColors.dark,
			)

			await Promise.all([
				fs.writeFile(lightColorsPath, lightColors),
				fs.writeFile(darkColorsPath, darkColors),
			])
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
