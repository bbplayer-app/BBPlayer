import * as Application from 'expo-application'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'
import { fetch } from 'react-native-nitro-fetch'

import log from '@/utils/log'

const INSTALLATION_KEY = 'update-telemetry-installation-id'
const logger = log.extend('updateTelemetry')

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

const configuredChannel = (): string => {
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
		update_group_id: null,
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
