import {
	getApkSigningCertificateSha256,
	getSentryInstallationId,
	installNativeTelemetry,
	setNativeTracesSampleRate,
} from '@bbplayer/native'
import { Orpheus } from '@bbplayer/orpheus'
import * as Sentry from '@sentry/react-native'
import type { ErrorEvent } from '@sentry/react-native'
import { isRunningInExpoGo } from 'expo'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'

import useAppStore from '@/hooks/stores/useAppStore'
import { getNativeModuleFingerprint } from '@/lib/config/sentryFingerprint'
import { configuredChannel } from '@/lib/services/updateTelemetry'
import { LogRateLimiter } from '@/lib/telemetry/logRateLimiter'
import { scrubText, scrubValue } from '@/lib/telemetry/scrub'
import { findErrorSpan } from '@/lib/tracing'
import log from '@/utils/log'

const logger = log.extend('Utils.Sentry')

const identifier = Application.applicationId
const development = process.env.NODE_ENV === 'development'

// DSN 由构建环境注入：只有官方构建流程会带上它。
// 公开仓库里默认没有 DSN，任何人克隆后直接构建都不会上报任何事件。
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? ''
const hasSentryDsn = SENTRY_DSN.length > 0

// release 固定为原生包的 `包名@版本+versionCode`（与原生 SDK 默认值一致），热更新不改 release，
// 改用 OTA_ATTRIBUTES 区分。必须在 JS 侧显式传：不传的话只走 JS 的 metrics 不会带 release。
// 热更新的 source map 按 debug ID 匹配，多个热更新共用一个 release 不会对错 source map。
const SENTRY_RELEASE =
	identifier &&
	Application.nativeApplicationVersion &&
	Application.nativeBuildVersion
		? `${identifier}@${Application.nativeApplicationVersion}+${Application.nativeBuildVersion}`
		: undefined

// 只有热更新包会在 expo export 时内联它（见 .github/workflows/update.yml），内嵌 bundle 没有
const OTA_COMMIT = process.env.EXPO_PUBLIC_OTA_COMMIT?.trim() || 'embedded'

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

type ExpoLaunchSource = 'emergency' | 'embedded' | 'ota'

function getExpoLaunchSource(): ExpoLaunchSource {
	if (Updates.isEmergencyLaunch) {
		return 'emergency'
	}

	return Updates.isEmbeddedLaunch ? 'embedded' : 'ota'
}

// 热更新相关属性统一用 app.ota.* 命名，同时设为全局 scope 的 tag（errors / transactions）
// 和 attribute（logs / metrics），两者都会同步到原生 SDK；JS 子 span 在 beforeSendTransaction 里补上。
// SDK 自带的 expo.updates.* tag 只加在 JS event 上，原生 event 没有，所以不依赖它
const OTA_ATTRIBUTES = {
	'app.ota.commit': OTA_COMMIT,
	'app.ota.update_id': Updates.updateId ?? 'none',
	'app.ota.launch_source': getExpoLaunchSource(),
	'app.ota.channel': configuredChannel(),
	'app.ota.runtime_version': Updates.runtimeVersion ?? 'unknown',
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

/** Sentry 的匿名安装 ID，用户反馈问题时用它在 Sentry 里查日志 */
let diagnosticId: string | null = null

export function getDiagnosticId(): string | null {
	// 启动时关闭、之后才开启数据分享的情况：ID 和原生 SDK 读的是同一个文件，重启后的上报会用它
	if (!diagnosticId && isSentryTelemetryEnabled()) {
		diagnosticId = getSentryInstallationId()
	}

	return diagnosticId
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
	if (event.message) event.message = scrubText(event.message)

	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = scrubText(exception.value)
	}

	event.breadcrumbs = scrubValue(event.breadcrumbs)
	event.extra = scrubValue(event.extra)
	event.tags = scrubValue(event.tags)
	// trace 里的 trace_id / span_id 要和 span 对得上，不能改
	const trace = event.contexts?.trace
	event.contexts = { ...scrubValue(event.contexts), trace }

	return event
}

export const navigationIntegration = Sentry.reactNavigationIntegration({
	enableTimeToInitialDisplay: !isRunningInExpoGo(),
})

logger.info('telemetry.sentry.configured', {
	'telemetry.enabled':
		!development &&
		isOfficialBuild &&
		useAppStore.getState().settings.enableDataCollection,
})

const logRateLimiter = new LogRateLimiter()

// 统一采样率；子 span 自动继承 parent 的采样决定，同一条 trace 要么全采要么全不采
const TRACES_SAMPLE_RATE = 1

export function initializeSentry() {
	// 在 init 之前取得：放进 initialScope，启动阶段的 JS 事件和日志也能带上 user.id
	diagnosticId = isSentryTelemetryEnabled() ? getSentryInstallationId() : null

	Sentry.init({
		dsn: SENTRY_DSN || undefined,
		release: SENTRY_RELEASE,
		debug: false,
		tracesSampleRate: TRACES_SAMPLE_RATE,
		// trace 按业务拆开后 envelope 数量多了一个数量级，默认 30 的发送队列和离线缓存
		// 在弱网 / 刚恢复联网时会被打满（client_discard 的 queue_overflow / cache_overflow）。
		// 两个值都会同时传给 JS transport 和原生 SDK
		maxQueueSize: 100,
		maxCacheItems: 100,
		integrations: [navigationIntegration],
		enableNativeFramesTracking: !isRunningInExpoGo(),
		// 点击带 testID 的元素会开启 ui.action.touch transaction，期间发起的 query / mutation 挂在它下面；
		// 没有子 span 的点击 transaction 会被 SDK 丢弃
		enableUserInteractionTracing: true,
		enabled: isSentryTelemetryEnabled(),
		// enabled=false 只拦得住 JS 事件：只要 enableNative 为 true，原生 SDK 仍会初始化，
		// NDK/ANR/tombstone 等原生崩溃会直接由原生侧上报。所以用户关闭数据采集或非官方签名时，
		// 把原生 SDK 一并关掉；会话中途关闭由各个 before* 回调和原生侧的开关拦截（自动会话见 NativeTelemetry.updateEnabled）。
		enableNative: isSentryTelemetryEnabled(),
		enableLogs: isSentryTelemetryEnabled(),
		// 原生日志由 installNativeTelemetry 在挂好脱敏和限流回调后再开启，
		// 避免初始化到挂接之间的日志未经处理就发出去
		logsOrigin: 'js',
		// console.* 不进 Sentry Logs，只上报 @bbplayer/logs 的日志
		enableAutoConsoleLogs: false,
		environment: getEnv(),
		ignoreErrors: ['ExpoHaptics', 'PlaylistAlreadyExists'],
		enableNdk: true,
		enableNdkScopeSync: true,
		enableTombstone: true,
		enableHistoricalTombstoneReporting: true,
		// ANR 发生期间对主线程采样，能看到卡住之前一直在做什么，而不只是被判定 ANR 那一刻的调用栈。
		// ANR 很少（每月十几次），全部采样也用不了多少 profiling 额度
		anrProfilingSampleRate: 1,
		// 原生事件由原生 SDK 自动带上同一个 ID
		initialScope: diagnosticId ? { user: { id: diagnosticId } } : undefined,
		onReady({ didCallNativeInit }) {
			if (!didCallNativeInit) return

			const installationId = installNativeTelemetry(isSentryTelemetryEnabled())
			// 原生请求（播放器解析音频地址等）的 span 与 JS 用同一采样率
			setNativeTracesSampleRate(TRACES_SAMPLE_RATE)

			// 播放服务通常比原生 SDK 先启动，补写那之前产生的播放器 context 和 tag
			if (Platform.OS === 'android') Orpheus.syncTelemetry()

			// 提前读取失败时的兜底
			if (!diagnosticId && installationId) {
				diagnosticId = installationId
				Sentry.setUser({ id: installationId })
			}
		},
		beforeBreadcrumb(breadcrumb) {
			// 关闭期间的 breadcrumb 不能留到重新开启后的事件里
			if (!isSentryTelemetryEnabled()) return null

			return scrubValue(breadcrumb)
		},
		beforeSendMetric(metric) {
			// 指标先在 SDK 里缓冲，发送前再查一次开关
			return isSentryTelemetryEnabled() ? metric : null
		},
		beforeSendLog(sentryLog) {
			if (!isSentryTelemetryEnabled()) return null

			// 用户可以开启本地 debug 日志，但 debug 不消耗远端 Logs 配额。
			if (sentryLog.level === 'debug' || sentryLog.level === 'trace')
				return null
			const scope = sentryLog.attributes?.['log.scope']

			const dropped = logRateLimiter.acquire(
				sentryLog.message,
				sentryLog.level,
				// oxlint-disable-next-line anti-slop/no-runtime-typeof -- SDK 属性允许多种类型，此处只接受字符串作用域。
				typeof scope === 'string' ? scope : '',
			)

			if (dropped === null) return null

			if (dropped > 0) {
				sentryLog.attributes = {
					...sentryLog.attributes,
					'bbplayer.rate_limited_before': dropped,
				}
			}

			// 模板参数会出现在 attributes 里，一起脱敏
			sentryLog.message = scrubText(String(sentryLog.message))
			sentryLog.attributes = scrubValue(sentryLog.attributes)

			return sentryLog
		},
		beforeSendTransaction(event) {
			if (!isSentryTelemetryEnabled()) return null

			// transaction 上的 tag 不会落到子 span，按热更新筛 span 需要每个子 span 自己带上
			for (const span of event.spans ?? []) {
				span.data = { ...span.data, ...OTA_ATTRIBUTES }
			}

			return event
		},
		beforeSend(event, hint) {
			// 用户可能在本次会话中途关闭数据采集
			if (!isSentryTelemetryEnabled()) return null

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

			return scrubEvent(event)
		},
	})

	const scope = Sentry.getGlobalScope()

	scope.setTags(OTA_ATTRIBUTES)
	scope.setAttributes(OTA_ATTRIBUTES)

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
