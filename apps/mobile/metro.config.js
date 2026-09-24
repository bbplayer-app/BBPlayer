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
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')
const { withBoostConfig } = require('react-native-boost/metro')

const sentryConfig = getSentryExpoConfig(__dirname, {
	annotateReactComponents: true,
	includeWebReplay: false,
	includeWebFeedback: false,
})

sentryConfig.resolver.unstable_enablePackageExports = true
sentryConfig.resolver.sourceExts.push('sql')

const withReanimated = wrapWithReanimatedMetroConfig(sentryConfig)

const withWorklets = getBundleModeMetroConfig(withReanimated)

const withBoost = withBoostConfig(withWorklets, {
	logLevel: 'debug',
	ignores: [
		'node_modules/**',
		'../../node_modules/**',
		path.resolve(
			__dirname,
			'../../packages/react-native-bottom-tabs/src/TabView.tsx',
		),
	],
})

const config = withRozenite(withBoost, {
	enabled: process.env.WITH_ROZENITE === 'true',
	enhanceMetroConfig: (config) =>
		withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(config)),
})

module.exports = config
