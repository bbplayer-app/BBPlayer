/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { execSync } from 'child_process'
import type { ConfigContext, ExpoConfig } from 'expo/config'
import { version } from './package.json'

const IS_DEV = process.env.APP_VARIANT === 'development'
const IS_PREVIEW = process.env.APP_VARIANT === 'preview'

// 使用 git commit 数量作为 versionCode
const getVersionCode = (): number => {
	const isCI = process.env.CI === 'true' || process.env.CI === '1'

	// 优先使用环境变量（CI 环境）
	if (process.env.VERSION_CODE) {
		const versionCode = parseInt(process.env.VERSION_CODE, 10)
		if (!isNaN(versionCode) && versionCode > 0) {
			return versionCode
		}
	}

	// CI 环境中必须提供 VERSION_CODE
	if (isCI) {
		throw new Error(
			'VERSION_CODE environment variable is required in CI environment. ' +
				'EAS build does not include .git directory, so git commands will fail.',
		)
	}

	// 本地开发时使用 git commit count
	try {
		const commitCount = execSync('git rev-list --count HEAD', {
			encoding: 'utf-8',
		}).trim()
		return parseInt(commitCount, 10)
	} catch (error) {
		throw new Error(
			`Failed to get git commit count for versionCode: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

const versionCode = getVersionCode()

const getUniqueIdentifier = () => {
	if (IS_DEV) {
		return 'com.roitium.bbplayer.dev'
	}

	if (IS_PREVIEW) {
		return 'com.roitium.bbplayer.preview'
	}

	return 'com.roitium.bbplayer'
}

const getAppName = () => {
	if (IS_DEV) {
		return 'BBPlayer (Dev)'
	}

	if (IS_PREVIEW) {
		return 'BBPlayer (Preview)'
	}

	return 'BBPlayer'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default ({ config }: ConfigContext): ExpoConfig => ({
	name: getAppName(),
	slug: 'bbplayer',
	version: version,
	orientation: 'portrait',
	icon: './assets/images/icon.png',
	scheme: 'bbplayer',
	userInterfaceStyle: 'automatic',
	platforms: ['android'],
	android: {
		adaptiveIcon: {
			foregroundImage: './assets/images/adaptive-icon.png',
			monochromeImage: './assets/images/adaptive-icon.png',
			backgroundColor: '#ffffff',
		},
		package: getUniqueIdentifier(),
		versionCode: versionCode,
		edgeToEdgeEnabled: true,
		runtimeVersion: version,
		intentFilters: [
			{
				action: 'VIEW',
				autoVerify: true,
				data: [
					{
						scheme: 'https',
						host: 'bbplayer.roitium.com',
						pathPrefix: '/app/link-to',
					},
				],
				category: ['BROWSABLE', 'DEFAULT'],
			},
		],
	},
	plugins: [
		'./expo-plugins/withAndroidPlugin',
		'./expo-plugins/withAndroidGradleProperties',
		[
			'./expo-plugins/withAbiFilters',
			{
				abiFilters: process.env.ABI_FILTERS
					? process.env.ABI_FILTERS.split(',')
					: ['arm64-v8a'],
			},
		],
		[
			'expo-dev-client',
			{
				launchMode: 'most-recent',
			},
		],
		[
			'expo-splash-screen',
			{
				image: './assets/images/splash-icon.png',
				imageWidth: 200,
				resizeMode: 'contain',
			},
		],
		[
			'@sentry/react-native/expo',
			{
				url: 'https://sentry.io/',
				project: 'bbplayer',
				organization: 'roitium',
			},
		],
		[
			'expo-build-properties',
			{
				android: {
					usesCleartextTraffic: true,
					enableMinifyInReleaseBuilds: false,
					enableShrinkResourcesInReleaseBuilds: false,
				},
			},
		],
		[
			'expo-asset',
			{
				assets: ['./assets/images/media3_notification_small_icon.png'],
			},
		],
		'expo-font',
		[
			'react-native-bottom-tabs',
			{
				theme: 'material3-dynamic',
			},
		],
		[
			'react-native-edge-to-edge',
			{
				android: {
					parentTheme: 'Material3',
				},
			},
		],
		'expo-web-browser',
		'expo-sqlite',
		[
			'expo-share-intent',
			{
				androidIntentFilters: ['text/*'],
				disableIOS: true,
			},
		],
		'expo-router',
		'@rnrepo/expo-config-plugin',
		[
			'expo-media-library',
			{
				photosPermission: '允许 $(PRODUCT_NAME) 访问您的相册',
				savePhotosPermission: '允许 $(PRODUCT_NAME) 保存图片到您的相册',
				isAccessMediaLocationEnabled: true,
			},
		],
	],
	experiments: {
		reactCompiler: true,
		typedRoutes: true,
	},
	extra: {
		eas: {
			projectId: '1cbd8d50-e322-4ead-98b6-4ee8b6f2a707',
		},
		updateManifestUrl:
			'https://cdn.jsdelivr.net/gh/bbplayer-app/bbplayer@master/update.json',
	},
	owner: 'roitium',
	updates: {
		url: 'https://u.expo.dev/1cbd8d50-e322-4ead-98b6-4ee8b6f2a707',
	},
	ios: {
		bundleIdentifier: 'com.roitium.bbplayer',
		runtimeVersion: {
			policy: 'appVersion',
		},
	},
})
