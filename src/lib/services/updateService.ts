import * as Sentry from '@sentry/react-native'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { err, ok, type Result } from 'neverthrow'

export interface ReleaseInfo {
	version: string
	notes: string
	listed_notes?: string[]
	url: string
	forced: boolean
}

export interface UpdateManifest {
	version: string
	notes?: string
	listed_notes?: string[]
	url: string
	forced?: boolean
}

const getManifestUrl = (): string | undefined => {
	const extra = Constants?.expoConfig?.extra as
		| { updateManifestUrl?: string }
		| undefined
	return extra?.updateManifestUrl
}

const toError = (e: unknown): Error =>
	e instanceof Error ? e : new Error(String(e))

const normalizeVersion = (v?: string | null): string => {
	if (!v) return '0.0.0'
	return v.startsWith('v') ? v.slice(1) : v
}

export const compareSemver = (a: string, b: string): number => {
	const pa = normalizeVersion(a)
		.split('.')
		.map((n) => parseInt(n, 10) || 0)
	const pb = normalizeVersion(b)
		.split('.')
		.map((n) => parseInt(n, 10) || 0)
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const ai = pa[i] ?? 0
		const bi = pb[i] ?? 0
		if (ai > bi) return 1
		if (ai < bi) return -1
	}
	return 0
}

export async function fetchLatestRelease(): Promise<
	Result<ReleaseInfo, Error>
> {
	return await Sentry.startSpan(
		{
			name: 'UpdateService.fetchLatestRelease',
			op: 'function',
		},
		async (span) => {
			try {
				const manifestUrl = getManifestUrl()
				span?.setAttribute('manifestUrl', manifestUrl)
				if (!manifestUrl) {
					return err(
						new Error('未在 app.config 中配置更新渠道 updateManifestUrl'),
					)
				}
				const res = await Sentry.startSpan(
					{ name: 'http:fetch:update-manifest', op: 'http' },
					() => fetch(manifestUrl, { cache: 'no-store' }),
				)
				span?.setAttribute('http.status_code', res.status)
				if (!res.ok) {
					return err(new Error(`拉取更新信息: ${res.status} ${res.statusText}`))
				}
				const json: unknown = await res.json()
				if (typeof json !== 'object' || json === null) {
					return err(new Error('更新信息格式错误'))
				}
				const obj = json as Record<string, unknown>
				const version = obj.version
				const url = obj.url
				if (typeof version !== 'string' || typeof url !== 'string') {
					return err(new Error('更新信息格式错误'))
				}
				const notes = typeof obj.notes === 'string' ? obj.notes : ''
				const listed_notes =
					Array.isArray(obj.listed_notes) &&
					obj.listed_notes.every((i) => typeof i === 'string')
						? obj.listed_notes
						: undefined
				const forced = typeof obj.forced === 'boolean' ? obj.forced : false
				const releaseInfo = {
					version: normalizeVersion(version),
					url,
					notes,
					listed_notes,
					forced,
				}
				span?.setAttribute('latest.version', releaseInfo.version)
				span?.setAttribute('forced', releaseInfo.forced)
				return ok(releaseInfo)
			} catch (e) {
				return err(toError(e))
			}
		},
	)
}

/**
 * 检查是否有新版本
 * @returns 如果没有新的版本，返回的 update 为 null
 */
export async function checkForAppUpdate(): Promise<
	Result<{ update: ReleaseInfo | null; currentVersion: string }, Error>
> {
	return await Sentry.startSpan(
		{
			name: 'UpdateService.checkForAppUpdate',
			op: 'function',
		},
		async (span) => {
			const currentVersion = normalizeVersion(
				Application.nativeApplicationVersion ?? '0.0.0',
			)
			span?.setAttribute('current.version', currentVersion)
			const latest = await fetchLatestRelease()
			if (latest.isErr()) return err(latest.error)
			const info = latest.value
			span?.setAttribute('latest.version', info.version)
			if (compareSemver(info.version, currentVersion) <= 0) {
				span?.setAttribute('hasUpdate', false)
				return ok({ update: null, currentVersion })
			}
			span?.setAttribute('hasUpdate', true)
			return ok({ update: info, currentVersion })
		},
	)
}
