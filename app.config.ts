import type { ConfigContext, ExpoConfig } from 'expo/config'
import { version, versionCode } from './package.json'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default ({ config }: ConfigContext): ExpoConfig => ({
	name: 'BBPlayer',
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
		package: 'com.roitium.bbplayer',
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
					enableMinifyInReleaseBuilds: true,
					enableShrinkResourcesInReleaseBuilds: true,
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
