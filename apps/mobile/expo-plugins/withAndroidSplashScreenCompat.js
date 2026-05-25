const { withAppBuildGradle } = require('expo/config-plugins')

const DEPENDENCY = 'implementation("androidx.core:core-splashscreen:1.0.1")'

const withAndroidSplashScreenCompat = (config) => {
	return withAppBuildGradle(config, (config) => {
		if (config.modResults.contents.includes(DEPENDENCY)) {
			return config
		}

		config.modResults.contents = config.modResults.contents.replace(
			/(dependencies\s*\{\s*)/,
			`$1\n    ${DEPENDENCY}\n`,
		)

		return config
	})
}

module.exports = withAndroidSplashScreenCompat
