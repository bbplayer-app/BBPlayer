const {
	withGradleProperties,
	withAppBuildGradle,
} = require('expo/config-plugins')

const withAbiFilters = (config, { abiFilters = ['arm64-v8a'] } = {}) => {
	// Set gradle.properties
	config = withGradleProperties(config, (config) => {
		// Convert array to comma-separated string for gradle.properties
		const architecturesString = abiFilters.join(',')

		// Set the reactNativeArchitectures property
		config.modResults = config.modResults.filter(
			(item) => !item.key || item.key !== 'reactNativeArchitectures',
		)

		config.modResults.push({
			type: 'property',
			key: 'reactNativeArchitectures',
			value: architecturesString,
		})

		return config
	})

	// Set build.gradle ndk.abiFilters
	config = withAppBuildGradle(config, (config) => {
		const abiFiltersString = abiFilters.map((abi) => `"${abi}"`).join(', ')

		// Keep the block inside defaultConfig, outside interpolated BuildConfig values.
		const contents = config.modResults.contents.replace(
			/\n?\/\/ @generated begin bbplayer-abi-filters[\s\S]*?\/\/ @generated end bbplayer-abi-filters\n?/g,
			'\n',
		)
		if (!/defaultConfig\s*\{/.test(contents)) {
			throw new Error('Cannot locate Android defaultConfig for ABI filters')
		}
		config.modResults.contents = contents.replace(
			/defaultConfig\s*\{/,
			`$&
        // @generated begin bbplayer-abi-filters
        ndk {
            abiFilters ${abiFiltersString}
        }
        // @generated end bbplayer-abi-filters`,
		)

		return config
	})

	return config
}

module.exports = withAbiFilters
