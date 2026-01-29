/* eslint-disable @typescript-eslint/no-require-imports */
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const {
	wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

module.exports = (async () => {
	const { withMetroConfig } = await import('react-native-monorepo-config')

	const config = getSentryExpoConfig(projectRoot, {
		annotateReactComponents: true,
	})

	const monorepoConfig = withMetroConfig(config, {
		root: workspaceRoot,
		dirname: projectRoot,
	})

	monorepoConfig.resolver.sourceExts.push('sql')

	return wrapWithReanimatedMetroConfig(monorepoConfig)
})()
