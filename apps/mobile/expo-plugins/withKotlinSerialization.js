const { withProjectBuildGradle } = require('expo/config-plugins')

const withKotlinSerialization = (config) => {
	return withProjectBuildGradle(config, (config) => {
		if (config.modResults.language === 'groovy') {
			const contents = config.modResults.contents
			if (!contents.includes('org.jetbrains.kotlin:kotlin-serialization')) {
				config.modResults.contents = contents.replace(
					/classpath\('org.jetbrains.kotlin:kotlin-gradle-plugin'\)/,
					`classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')\n        classpath('org.jetbrains.kotlin:kotlin-serialization')`,
				)
			}
		}
		return config
	})
}

module.exports = withKotlinSerialization
