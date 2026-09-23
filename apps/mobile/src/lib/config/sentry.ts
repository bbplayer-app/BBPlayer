import { getApkSigningCertificateSha256 } from '@bbplayer/native'
import * as Sentry from '@sentry/react-native'
import { isRunningInExpoGo } from 'expo'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'

import useAppStore from '@/hooks/stores/useAppStore'
import { configuredChannel } from '@/lib/services/updateTelemetry'
import log from '@/utils/log'

const logger = log.extend('Utils.Sentry')

const identifier = Application.applicationId
const development = process.env.NODE_ENV === 'development'

// 仅在官方应用包名上启用 Sentry，其他标识（Expo Go、第三方套壳等）一律忽略
// 忽略最后一个字母，允许用户改包名共存（其实是我有时候要测试）
const isOfficialApp = identifier?.startsWith('com.roitium.bbplaye') ?? false

/**
 * 官方 APK 签名证书的 SHA-256 指纹（小写十六进制）。
 *
 * 留空表示「尚未配置」：此时不做签名校验，避免忘记填写导致上报静默停止。
 */
const OFFICIAL_APK_SIGNING_CERT_SHA256: readonly string[] = [
	'ddde56261ccb62dcf8117516499e04ffe9ddf31e59ba4cb80e1d047fd6977936',
]

const apkSigningCertificateSha256 = getApkSigningCertificateSha256()

// 只在能拿到指纹的 Android 上校验；列表留空视为未配置，直接放行。
const hasOfficialSignature =
	Platform.OS !== 'android' ||
	OFFICIAL_APK_SIGNING_CERT_SHA256.length === 0 ||
	(apkSigningCertificateSha256 !== null &&
		OFFICIAL_APK_SIGNING_CERT_SHA256.includes(apkSigningCertificateSha256))

const isOfficialBuild = isOfficialApp && hasOfficialSignature

const getEnv = () => {
	if (development) {
		return 'development'
	}
	// 这不可能发生，只在 web 端会是 null
	if (!identifier) {
		return 'development'
	}
	if (identifier === 'com.roitium.bbplayer.dev') {
		return 'development'
	} else if (identifier === 'com.roitium.bbplayer.preview') {
		return 'preview'
	}
	return 'production'
}

export const navigationIntegration = Sentry.reactNavigationIntegration({
	enableTimeToInitialDisplay: !isRunningInExpoGo(),
})

logger.info(
	'Sentry 启用状态为：',
	!development &&
		isOfficialBuild &&
		useAppStore.getState().settings.enableDataCollection,
)

export function initializeSentry() {
	Sentry.init({
		dsn: 'https://893ea8eb3743da1e065f56b3aa5e96f9@o4508985265618944.ingest.us.sentry.io/4508985267191808',
		debug: false,
		tracesSampleRate: 0.3,
		integrations: [navigationIntegration],
		enableNativeFramesTracking: !isRunningInExpoGo(),
		enabled:
			!development &&
			isOfficialBuild &&
			useAppStore.getState().settings.enableDataCollection,
		// enabled=false 只拦得住 JS 事件：ReactNativeClient.init() 仍会无条件
		// 初始化原生 SDK，NDK/ANR/tombstone 等原生崩溃会直接由原生侧上报。
		// 因此非官方签名时把原生 SDK 一并关掉。
		enableNative: isOfficialBuild && !development,
		enableLogs: false,
		environment: getEnv(),
		ignoreErrors: ['ExpoHaptics', 'PlaylistAlreadyExists'],
		enableNdk: true,
		enableNdkScopeSync: true,
		enableTombstone: true,
		enableHistoricalTombstoneReporting: true,
	})

	const scope = Sentry.getGlobalScope()
	const launchSource = Updates.isEmergencyLaunch
		? 'emergency'
		: Updates.isEmbeddedLaunch
			? 'embedded'
			: 'ota'

	scope.setTag('expo-update-id', Updates.updateId ?? 'none')
	scope.setTag('expo-is-embedded-update', String(Updates.isEmbeddedLaunch))
	scope.setTag('expo-channel', configuredChannel())
	scope.setTag('expo-runtime-version', Updates.runtimeVersion ?? 'unknown')
	scope.setTag('expo-launch-source', launchSource)

	// 设置全局错误处理器，捕获未被处理的 JS 错误
	if (!development) {
		// oxlint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const errorUtils = (global as any).ErrorUtils
		if (errorUtils) {
			// oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			const originalErrorHandler = errorUtils.getGlobalHandler()

			// oxlint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
				Sentry.captureException(error, {
					tags: {
						scope: 'GlobalErrorHandler',
						isFatal: String(isFatal),
					},
				})

				// oxlint-disable-next-line @typescript-eslint/no-unsafe-call
				originalErrorHandler(error, isFatal)
			})
		}
	}
}
