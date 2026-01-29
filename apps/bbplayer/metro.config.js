/* eslint-disable @typescript-eslint/no-require-imports */
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const {
	wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config')

module.exports = (async () => {
	const config = getSentryExpoConfig(__dirname, {
		annotateReactComponents: true,
	})

	config.resolver.unstable_enablePackageExports = true
	config.resolver.sourceExts.push('sql')

	return wrapWithReanimatedMetroConfig(config)
})()
