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
	ignores: ['node_modules/**', '../../node_modules/**'],
})

// The Linux iOS build leaves these native modules out, so swap their JS for no-ops.
if (process.env.BBPLAYER_IOS_LITE === '1') {
	const stubDir = path.join(__dirname, 'ios-lite/stubs')
	const stubs = {
		'@react-native-firebase/analytics': 'firebase-analytics.ts',
		'@sentry/react-native': 'sentry.tsx',
		'expo-app-metrics': 'app-metrics.ts',
		'expo-observe': 'observe.tsx',
		'expo-updates': 'updates.ts',
		'react-native-release-profiler': 'release-profiler.ts',
	}
	const upstreamResolve = withBoost.resolver.resolveRequest
	withBoost.resolver.resolveRequest = (context, moduleName, platform) => {
		if (platform === 'ios' && stubs[moduleName]) {
			return {
				type: 'sourceFile',
				filePath: path.join(stubDir, stubs[moduleName]),
			}
		}
		return upstreamResolve
			? upstreamResolve(context, moduleName, platform)
			: context.resolveRequest(context, moduleName, platform)
	}
}

const config = withRozenite(withBoost, {
	enabled: process.env.WITH_ROZENITE === 'true',
	enhanceMetroConfig: (config) =>
		withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(config)),
})

module.exports = config
