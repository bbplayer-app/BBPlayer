const {
	withGradleProperties,
	withAppBuildGradle,
} = require('expo/config-plugins')

const ABI_FILTERS_BEGIN_MARKER = '// BEGIN expo-plugins/withAbiFilters'
const ABI_FILTERS_END_MARKER = '// END expo-plugins/withAbiFilters'
const MANAGED_ABI_FILTERS_BLOCK_REGEX = new RegExp(
	`\\n\\s*${ABI_FILTERS_BEGIN_MARKER}\\s*\\r?\\n[\\s\\S]*?\\r?\\n\\s*${ABI_FILTERS_END_MARKER}\\s*\\r?\\n?`,
	'g',
)

const upsertAbiFilters = (contents, abiFiltersString) => {
	const ndkBlock = `        ${ABI_FILTERS_BEGIN_MARKER}
        ndk {
            abiFilters ${abiFiltersString}
        }
        ${ABI_FILTERS_END_MARKER}
`

	const contentsWithoutManagedBlock = contents.replace(
		MANAGED_ABI_FILTERS_BLOCK_REGEX,
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
