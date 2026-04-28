const {
	withGradleProperties,
	withAppBuildGradle,
} = require('expo/config-plugins')

const upsertAbiFilters = (contents, abiFiltersString) => {
	const ndkBlock = `        ndk {
            abiFilters ${abiFiltersString}
        }
`

	const contentsWithoutManagedBlock = contents.replace(
		/\n\s*ndk\s*\{\s*\n\s*abiFilters\s+[^\n]+\n\s*\}/g,
		'',
	)

	return contentsWithoutManagedBlock.replace(
		/(defaultConfig\s*\{[ \t]*\r?\n)/,
		`$1${ndkBlock}`,
	)
}

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

		// Add ndk abiFilters to defaultConfig without depending on the
		// generated build.gradle field order.
		if (config.modResults.contents.includes('defaultConfig {')) {
			config.modResults.contents = upsertAbiFilters(
				config.modResults.contents,
				abiFiltersString,
			)
		}

		return config
	})

	return config
}

module.exports = withAbiFilters
