import { execSync } from 'child_process'

import type { ConfigContext, ExpoConfig } from 'expo/config'

import { version } from './package.json'

const IS_DEV = process.env.APP_VARIANT === 'development'
const IS_PREVIEW = process.env.APP_VARIANT === 'preview'

// 使用 git commit 数量作为 versionCode
const getVersionCode = (): number => {
	const versionCodeEnv = process.env.VERSION_CODE ?? undefined
	const pwd = process.cwd()
	// EAS 环境的行为很奇怪，似乎不会复制 .git 目录，所以需要特殊强制外部提供 versionCode
	const isInEAS = pwd.includes('eas-build-local-nodejs')
	if (versionCodeEnv !== undefined) {
		const versionCode = parseInt(versionCodeEnv, 10)
		if (!isNaN(versionCode) && versionCode > 0) {
			return versionCode
		}
	} else if (!isInEAS) {
		const versionCodeString = execSync('git rev-list --count HEAD')
			.toString()
			.trim()
		const versionCode = parseInt(versionCodeString, 10)
		if (!isNaN(versionCode) && versionCode > 0) {
			return versionCode
		}
	}

	throw new Error('VERSION_CODE environment variable is required or not in EAS')
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
	platforms: ['android', 'ios'],
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
					{
						scheme: 'https',
						host: 'app.bbplayer.roitium.com',
					},
				],
				category: ['BROWSABLE', 'DEFAULT'],
			},
		],
	},
	plugins: [
		// './expo-plugins/withAndroidPlugin',
		'./expo-plugins/withAndroidGradleProperties',
		[
			'./expo-plugins/withAbiFilters',
			{
				abiFilters:
					typeof process.env.ABI_FILTERS === 'string'
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
					enableMinifyInReleaseBuilds: true,
					enableShrinkResourcesInReleaseBuilds: true,
					packagingOptions: {
						pickFirst: ['lib/*/libNitroModules.so'],
					},
					extraProguardRules: `
-dontwarn expo.modules.kotlin.**
-dontwarn expo.modules.webview.**
# --- 来自 retrofit2.pro ---
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface * extends <1>
-keep,allowoptimization,allowshrinking,allowobfuscation class kotlin.coroutines.Continuation
-if interface * { @retrofit2.http.* public *** *(...); }
-keep,allowoptimization,allowshrinking,allowobfuscation class <3>
-keep,allowoptimization,allowshrinking,allowobfuscation class retrofit2.Response
# --- 来自 retrofit2.pro ---
					`,
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
