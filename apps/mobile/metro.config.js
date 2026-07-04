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

const sentryConfig = getSentryExpoConfig(__dirname, {
	annotateReactComponents: true,
})

sentryConfig.resolver.unstable_enablePackageExports = true
sentryConfig.resolver.sourceExts.push('sql')

const withReanimated = wrapWithReanimatedMetroConfig(sentryConfig)

const withWorklets = getBundleModeMetroConfig(withReanimated)

const config = withRozenite(withWorklets, {
	enabled: process.env.WITH_ROZENITE === 'true',
	enhanceMetroConfig: (config) =>
		withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(config)),
})

module.exports = config
