const fs = require('fs')
const path = require('path')

const { withDangerousMod } = require('expo/config-plugins')

const withRemoveExpoSplashScreen = (config) => {
	return withDangerousMod(config, [
		'android',
		async (config) => {
			const mainActivityPath = path.join(
				config.modRequest.platformProjectRoot,
				'app/src/main/java/com/roitium/bbplayer/MainActivity.kt',
			)

			if (!fs.existsSync(mainActivityPath)) {
				return config
			}

			let contents = fs.readFileSync(mainActivityPath, 'utf8')
			contents = contents.replace(
				/\nimport expo\.modules\.splashscreen\.SplashScreenManager\n/,
				'\n',
			)
			contents = contents.replace(
				/\n\s*\/\/ @generated begin expo-splashscreen[\s\S]*?\/\/ @generated end expo-splashscreen\n/,
				'\n',
			)
			fs.writeFileSync(mainActivityPath, contents)

			return config
		},
	])
}

module.exports = withRemoveExpoSplashScreen
