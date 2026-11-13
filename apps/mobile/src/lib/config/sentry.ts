import { getApkSigningCertificateSha256 } from '@bbplayer/native'
import * as Sentry from '@sentry/react-native'
import { isRunningInExpoGo } from 'expo'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'

import useAppStore from '@/hooks/stores/useAppStore'
import { getNativeModuleFingerprint } from '@/lib/config/sentryFingerprint'
import { configuredChannel } from '@/lib/services/updateTelemetry'
import { findErrorSpan } from '@/lib/tracing'
import log from '@/utils/log'

const logger = log.extend('Utils.Sentry')

const identifier = Application.applicationId
const development = process.env.NODE_ENV === 'development'

// DSN 由构建环境注入：只有官方构建流程会带上它。
// 公开仓库里默认没有 DSN，任何人克隆后直接构建都不会上报任何事件。
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? ''
const hasSentryDsn = SENTRY_DSN.length > 0

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

// Android 用 APK 签名证书校验；列表留空视为未配置，直接放行。
const hasOfficialAndroidSignature =
	OFFICIAL_APK_SIGNING_CERT_SHA256.length === 0 ||
	(apkSigningCertificateSha256 !== null &&
		OFFICIAL_APK_SIGNING_CERT_SHA256.includes(apkSigningCertificateSha256))

// Android 额外校验 APK 签名证书；iOS 无法在运行时可靠校验自身签名
// （App Store 分发包会剥离 embedded.mobileprovision），只依赖注入的 DSN。
const hasOfficialPlatformProof =
	Platform.OS === 'android' ? hasOfficialAndroidSignature : true

const isOfficialBuild =
	hasSentryDsn && isOfficialApp && hasOfficialPlatformProof

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

export type ExpoLaunchSource = 'emergency' | 'embedded' | 'ota'

export function getExpoLaunchSource(): ExpoLaunchSource {
	if (Updates.isEmergencyLaunch) {
		return 'emergency'
	}

	return Updates.isEmbeddedLaunch ? 'embedded' : 'ota'
}

// 与 Sentry.init 的 enabled 口径保持一致，并读取当前设置：
// 用户可能在本次会话中途关闭数据采集。
export function isSentryTelemetryEnabled(): boolean {
	return (
		!development &&
		isOfficialBuild &&
		useAppStore.getState().settings.enableDataCollection
	)
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

// testID 风格的标识：英文、数字、`-`、`_`
const INTERACTION_ID_PATTERN = /^[\w-]+$/

// 标识末尾的动态部分（数字下标 / id），如 track-item-12
const INTERACTION_DYNAMIC_SUFFIX = /-\d+$/

/**
 * 用户点击 transaction 的名字是 `{route}.{元素标识}`。元素标识可能来自带下标 / id 的 testID，
 * 或者来自 accessibilityLabel（可能包含歌名、评论等用户内容），这里统一收敛成低基数、不含用户内容的名字。
 */
function normalizeInteractionName(name: string): string {
	const separator = name.indexOf('.')

	if (separator === -1) return name

	const route = name.slice(0, separator)
	const label = name.slice(separator + 1)

	if (!INTERACTION_ID_PATTERN.test(label)) return `${route}.<a11y_label>`

	return `${route}.${label.replace(INTERACTION_DYNAMIC_SUFFIX, '')}`
}

export function initializeSentry() {
	Sentry.init({
		dsn: SENTRY_DSN || undefined,
		debug: false,
		tracesSampler(samplingContext) {
			const name = samplingContext.name ?? ''
			const parentSampled = samplingContext.parentSampled

			// 继承父 transaction 的采样决定（同一 trace 要么全采要么全不采）
			if (parentSampled !== undefined) {
				return parentSampled ? 1 : 0
			}

			// 业务 transaction：高采样率
			if (
				name === 'playback.start' ||
				name.startsWith('sync.') ||
				name === 'update.check'
			) {
				return 0.8
			}

			// 每次切歌都会触发，且大多命中本地缓存，信息密度低
			if (name === 'lyrics.smart_fetch') {
				return 0.2
			}

			// 用户主动发起的 mutation（UI 操作期间的会继承 UI transaction 的采样决定）
			if (samplingContext.attributes?.['sentry.op'] === 'mutation') {
				return 0.3
			}

			// 后台 refetch、分页等单独成 transaction 的 query：量大，低采样
			if (samplingContext.attributes?.['sentry.op'] === 'query') {
				return 0.1
			}

			// 导航 transaction：低采样率（量大，信息密度低）
			if (
				samplingContext.attributes?.['sentry.op'] === 'navigation' ||
				samplingContext.attributes?.['sentry.op'] === 'pageload'
			) {
				return 0.1
			}

			// 其余 transaction（app 启动、自动检测等）保持适中采样率
			return 0.3
		},
		integrations: [navigationIntegration],
		enableNativeFramesTracking: !isRunningInExpoGo(),
		// 点击带 testID 的元素会开启 ui.action.touch transaction，期间发起的 query / mutation 挂在它下面；
		// 没有子 span 的点击 transaction 会被 SDK 丢弃
		enableUserInteractionTracing: true,
		beforeSendTransaction(event) {
			if (
				event.contexts?.trace?.op?.startsWith('ui.action') &&
				event.transaction
			) {
				event.transaction = normalizeInteractionName(event.transaction)
			}

			return event
		},
		enabled: isSentryTelemetryEnabled(),
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
		beforeSend(event, hint) {
			const fingerprint = getNativeModuleFingerprint(event)

			if (fingerprint) {
				event.fingerprint = fingerprint
			}

			// 显式传递的 span 不在全局 scope 里，这里把错误关联回它失败时所在的 trace
			const span =
				hint.originalException instanceof Error
					? findErrorSpan(hint.originalException)
					: undefined

			if (span) {
				const { trace_id, span_id } = Sentry.spanToJSON(span)
				event.contexts = {
					...event.contexts,
					trace: { ...event.contexts?.trace, trace_id, span_id },
				}
			}

			return event
		},
	})

	const scope = Sentry.getGlobalScope()

	scope.setTag('expo-update-id', Updates.updateId ?? 'none')
	scope.setTag('expo-is-embedded-update', String(Updates.isEmbeddedLaunch))
	scope.setTag('expo-channel', configuredChannel())
	scope.setTag('expo-runtime-version', Updates.runtimeVersion ?? 'unknown')
	scope.setTag('expo-launch-source', getExpoLaunchSource())

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
