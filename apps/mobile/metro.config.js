/* oxlint-disable @typescript-eslint/no-require-imports */
const path = require('path')
const { withRozenite } = require('@rozenite/metro')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const {
	withRozeniteRequireProfiler,
} = require('@rozenite/require-profiler-plugin/metro')
const {
	withRozeniteBundleDiscoveryPlugin,
} = require('react-native-bundle-discovery-rozenite-plugin')
const {
	wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config')

module.exports = withRozenite(
	(async () => {
		const config = getSentryExpoConfig(__dirname, {
			annotateReactComponents: true,
		})

		config.resolver.unstable_enablePackageExports = true
		config.resolver.sourceExts.push('sql')

		return wrapWithReanimatedMetroConfig(config)
	})(),
	{
		enabled: process.env.WITH_ROZENITE === 'true',
		enhanceMetroConfig: (config) =>
			withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(config)),
	},
)
