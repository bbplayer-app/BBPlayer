import * as Application from 'expo-application'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'
import { fetch } from 'react-native-nitro-fetch'

import log from '@/utils/log'

const INSTALLATION_KEY = 'update-telemetry-installation-id'
const UPDATE_CHANNEL_OVERRIDE_KEY = 'update-channel-override'
const logger = log.extend('updateTelemetry')

// expo-updates 只允许覆盖 app.config.ts 的 updates.requestHeaders 里已声明的
// key（占位值见 app.config.ts，两侧必须保持一致），因此不能凭空新增 header。
// 请求头 override 会整体替换内嵌配置，所以这里必须同时写入渠道和安装 id。
export const UPDATE_REQUEST_HEADER = 'x-bbplayer-installation-id'
export const UPDATE_CHANNEL_HEADER = 'expo-channel-name'

// Mirrors update-server's EventType vocabulary. Add event values in both
// clients deliberately, rather than sending unconstrained strings.
export const UpdateTelemetryEventType = {
	Activity: 'activity',
	LaunchSucceeded: 'launch_succeeded',
	LaunchFailed: 'launch_failed',
} as const

type EventType =
	(typeof UpdateTelemetryEventType)[keyof typeof UpdateTelemetryEventType]

const randomUUID = (): string => {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID()
	}
	const bytes = new Uint8Array(16)
	if (typeof globalThis.crypto?.getRandomValues === 'function') {
		globalThis.crypto.getRandomValues(bytes)
	} else {
		for (let index = 0; index < bytes.length; index++) {
			bytes[index] = Math.floor(Math.random() * 256)
		}
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	const hex = [...bytes]
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const serverURL = (): string | null => {
	const extra = Constants.expoConfig?.extra as
		| { updateServerUrl?: string }
		| undefined
	return extra?.updateServerUrl ?? null
}

export const configuredChannel = (): string => {
	const extra = Constants.expoConfig?.extra as
		| { updateChannel?: string }
		| undefined
	return Updates.channel ?? extra?.updateChannel ?? 'unknown'
}

const installationID = async (): Promise<string> => {
	const current = await SecureStore.getItemAsync(INSTALLATION_KEY)
	if (current) return current
	const created = randomUUID()
	await SecureStore.setItemAsync(INSTALLATION_KEY, created)
	return created
}

let requestHeadersOverridden = false

const applyUpdateRequestHeaders = async (channel: string): Promise<void> => {
	const id = await installationID()
	Updates.setUpdateRequestHeadersOverride({
		[UPDATE_CHANNEL_HEADER]: channel,
		[UPDATE_REQUEST_HEADER]: id,
	})
	requestHeadersOverridden = true
}

export const setUpdateChannelOverride = async (
	channel: string,
): Promise<void> => {
	if (!Updates.isEnabled) {
		throw new Error('expo-updates 未启用')
	}
	await SecureStore.setItemAsync(UPDATE_CHANNEL_OVERRIDE_KEY, channel)
	await applyUpdateRequestHeaders(channel)
}

/**
 * 把本安装的稳定 id 与有效更新渠道一起写入 expo-updates 的原生请求头 override。
 *
 * expo-updates 会把 override 持久化，从下一次启动起，即使 JS 尚未运行（甚至
 * 上次启动刚崩溃），原生发起的 update check 请求也会带上这个 id，服务端即可
 * 按 installation 精确去重、推断 known launch / known crash（参考 EAS Update
 * dashboard 的同名指标，详见 apps/update-server 的 api_insights.go）。
 *
 * 已知盲区（设计取舍）：全新安装后的第一次启动、以及从未成功跑过一次 JS 的
 * 设备，发出的仍是 app.config.ts 里的占位值，服务端会直接忽略这些请求；
 * 开发构建 / expo-updates 未启用 / 未预置该 key 的旧包会抛错，这里吞掉即可。
 */
export const initializeUpdateRequestHeaders = async (): Promise<void> => {
	if (requestHeadersOverridden || !Updates.isEnabled) return
	try {
		const channel =
			(await SecureStore.getItemAsync(UPDATE_CHANNEL_OVERRIDE_KEY)) ??
			configuredChannel()
		await applyUpdateRequestHeaders(channel)
	} catch (error: unknown) {
		logger.warning('设置 update request headers 失败', { error })
	}
}

const report = async (eventType: EventType): Promise<void> => {
	const baseURL = serverURL()
	if (!baseURL || !Updates.isEnabled || !Updates.updateId) return
	const source = Updates.isEmergencyLaunch
		? 'emergency'
		: Updates.isEmbeddedLaunch
			? 'embedded'
			: 'ota'
	const payload = {
		event_id: randomUUID(),
		schema_version: 1,
		event_type: eventType,
		occurred_at: new Date().toISOString(),
		installation_id: await installationID(),
		client_version: Application.nativeApplicationVersion ?? 'unknown',
		client_build_version: Application.nativeBuildVersion ?? 'unknown',
		expo_updates_version: Constants.expoConfig?.sdkVersion ?? 'unknown',
		updates_protocol_version: '1',
		platform: Platform.OS,
		runtime_version: Updates.runtimeVersion ?? 'unknown',
		channel: configuredChannel(),
		launched_update_id: Updates.updateId,
		embedded_update_id: Updates.isEmbeddedLaunch ? Updates.updateId : null,
		launch_source: source,
		payload: Updates.isEmergencyLaunch
			? { emergency_launch_reason: Updates.emergencyLaunchReason ?? 'unknown' }
			: {},
	}
	const response = await fetch(`${baseURL}/api/events`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!response.ok) {
		throw new Error(`update telemetry: ${response.status}`)
	}
}

const reportSafely = (eventType: EventType): void => {
	void report(eventType).catch((error: unknown) => {
		logger.warning('上报 OTA 遥测失败', { eventType, error })
	})
}

export const reportUpdateActivity = (): void =>
	reportSafely(UpdateTelemetryEventType.Activity)

export const reportUpdateLaunch = (): void =>
	reportSafely(
		Updates.isEmergencyLaunch
			? UpdateTelemetryEventType.LaunchFailed
			: UpdateTelemetryEventType.LaunchSucceeded,
	)
