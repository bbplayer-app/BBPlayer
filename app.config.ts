import type { ConfigContext, ExpoConfig } from 'expo/config'
import { version, versionCode } from './package.json'

const IS_DEV = process.env.APP_VARIANT === 'development'
const IS_PREVIEW = process.env.APP_VARIANT === 'preview'

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
	newArchEnabled: true,
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
				abiFilters: ['arm64-v8a'],
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
