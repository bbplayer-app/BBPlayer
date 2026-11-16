/* oxlint-disable @typescript-eslint/no-require-imports */
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

// Expo CLI 把 RN 的 HMRClient 重定向到 expo/src/async-require/hmr.ts，启动时 setup 的是它；
// 开了 unstable_enablePackageExports 后，懒加载 bundle 用的 loadBundle 却解析到 expo/build/... 下的另一份 hmr.js，
// 那一份从未 setup，开发环境打开懒加载的页面会报 "Expected HMRClient.setup() call at startup."。
// 这里把它指回同一份模块。
const upstreamResolveRequest = sentryConfig.resolver.resolveRequest
sentryConfig.resolver.resolveRequest = (context, moduleName, platform) => {
	const resolution = (upstreamResolveRequest ?? context.resolveRequest)(
		context,
		moduleName,
		platform,
	)
	if (
		resolution.type === 'sourceFile' &&
		resolution.filePath.endsWith('/expo/build/async-require/hmr.js')
	) {
		return {
			type: 'sourceFile',
			filePath: resolution.filePath.replace(
				/build\/async-require\/hmr\.js$/,
				'src/async-require/hmr.ts',
			),
		}
	}
	return resolution
}

const withReanimated = wrapWithReanimatedMetroConfig(sentryConfig)

const withWorklets = getBundleModeMetroConfig(withReanimated)

const withBoost = withBoostConfig(withWorklets, {
	logLevel: 'debug',
	ignores: ['node_modules/**', '../../node_modules/**'],
})

const config = withRozenite(withBoost, {
	enabled: process.env.WITH_ROZENITE === 'true',
	enhanceMetroConfig: (config) =>
		withRozeniteBundleDiscoveryPlugin(withRozeniteRequireProfiler(config)),
})

module.exports = config
