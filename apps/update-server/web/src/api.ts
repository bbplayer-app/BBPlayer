import { getToken, reportUnauthorized } from '@/lib/auth'

export type Platform = 'android' | 'ios'

export type FleetRow = {
	channel: string
	runtime_version: string
	platform: Platform
	app_version: string
	active_users: number
	head_mode: '' | 'ota' | 'embedded'
	head_group_id?: string
	head_updated_at?: string
	head_message: string
	head_created_at?: string
	head_commit_sha: string
	head_users: number
	head_launches: number
	head_crashes: number
}

export type HistoryEntry = {
	id: number
	channel: string
	runtime_version: string
	platform: Platform
	group_id?: string
	mode: 'ota' | 'embedded'
	action: string
	created_at: string
	message: string
	commit_sha: string
	app_version: string
}

export type Overview = {
	fleet: FleetRow[]
	history: HistoryEntry[]
	patches: { failed: number; pending: number }
}

export type Release = {
	id: string
	channel: string
	runtime_version: string
	app_version: string
	message: string
	created_at: string
	commit_sha: string
	republished_from_group_id?: string
	platforms: Platform[]
	live_platforms: Platform[]
	launches: number
	crashes: number
	active_users: number
	downloads: number
}

export type PatchStatus =
	| 'pending'
	| 'processing'
	| 'ready'
	| 'failed'
	| 'not_beneficial'

export type ReleasePlatform = {
	id: string
	platform: Platform
	launch_key: string
	launch_hash: string
	launch_size: number
	full_downloads: number
	patch_downloads: number
	patch_bytes: number
	patch_target_bytes: number
	known_launches: number
	known_crashes: number
	is_live: boolean
	patches: {
		id: number
		from_update_id: string
		from_group_id: string
		from_message: string
		status: PatchStatus
		size_bytes?: number
		attempts: number
		served_count: number
		error?: string
		updated_at: string
	}[]
}

export type ReleaseDetail = {
	id: string
	channel: string
	runtime_version: string
	app_version: string
	message: string
	created_at: string
	source: unknown
	fingerprint_hash?: string
	fingerprint_sources: unknown
	republished_from_group_id?: string
	previous?: {
		id: string
		message: string
		created_at: string
		commit_sha: string
	}
	platforms: ReleasePlatform[]
}

export type Asset = {
	id: number
	asset_key: string
	content_type: string
	size_bytes: number
	is_launch: boolean
}

export type Head = {
	runtime_version: string
	platform: Platform
	group_id: string
	mode: 'ota' | 'embedded'
	updated_at: string
}

const base = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(path: string, init?: RequestInit) {
	const token = getToken()

	const headers = new Headers(init?.headers)

	if (token) headers.set('Authorization', `Bearer ${token}`)

	const r = await fetch(base + path, { ...init, headers })

	if (r.status === 401) {
		reportUnauthorized()
		throw new Error('Unauthorized')
	}

	if (!r.ok) {
		let message = `Request failed (${r.status})`

		try {
			const payload = (await r.json()) as { detail?: string; error?: string }
			message = payload.detail ?? payload.error ?? message
		} catch {
			// keep the generic message
		}

		throw new Error(message)
	}

	return r
}

async function api<T>(path: string) {
	return (await request(path)).json() as Promise<T>
}

async function apiPost(path: string, body: unknown) {
	await request(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
}

const zeroUUID = '00000000-0000-0000-0000-000000000000'

export function headGroupID(head: Head): string | null {
	return head.group_id === zeroUUID ? null : head.group_id
}

export async function verifyToken(token: string) {
	const r = await fetch(base + '/admin/session', {
		headers: { Authorization: `Bearer ${token}` },
	})

	return r.ok
}

export const overview = () => api<Overview>('/admin/dashboard/overview')

export const history = (channelName: string, limit = 50) => {
	const params = new URLSearchParams({ limit: String(limit) })

	if (channelName) params.set('channel', channelName)

	return api<HistoryEntry[]>(`/admin/dashboard/history?${params}`)
}

export const releases = () => api<Release[]>('/admin/dashboard/releases')

export const release = (id: string) =>
	api<ReleaseDetail>(`/admin/dashboard/updates/${encodeURIComponent(id)}`)

export const adoption = (id: string, days: number) =>
	api<{ day: string; release_users: number; runtime_users: number }[]>(
		`/admin/dashboard/updates/${encodeURIComponent(id)}/adoption?days=${days}`,
	)

export const assets = (id: string, platform: Platform) =>
	api<Asset[]>(
		`/admin/dashboard/updates/${encodeURIComponent(id)}/platforms/${platform}/assets`,
	)

export const lifecycle = (id: string, start: string) =>
	api<{
		series: { day: string; known_launches: number; known_crashes: number }[]
	}>(
		`/admin/insights/groups/${encodeURIComponent(id)}/lifecycle?start=${encodeURIComponent(start)}`,
	)

export const insights = () =>
	api<{
		summary: {
			unique_users: number
			downloads: number
			launch_successes: number
			launch_failures: number
			launch_failure_rate: number
		}
		transport: {
			full_requests: number
			full_bytes: number
			bsdiff_requests: number
			bsdiff_bytes: number
			bsdiff_target_bytes: number
			bsdiff_saved_bytes: number
			bsdiff_fallbacks: number
			bsdiff_hit_rate: number
		}
	}>('/admin/insights')

export const service = () =>
	api<{
		series: {
			minute: string
			requests: number
			errors: number
			error_rate: number
			average_duration_ms: number
		}[]
	}>('/admin/metrics/service')

export type AudienceTotals = {
	active_users: number
	new_users: number
	active_user_days: number
}

export type Audience = {
	start: string
	end: string
	previous_start: string
	data_start: string
	current: AudienceTotals
	previous: AudienceTotals
	today: AudienceTotals
	series: {
		day: string
		dau: number
		wau: number
		mau: number
		new_users: number
	}[]
	versions: { client_version: string; users: number; ota_users: number }[]
	channels: { channel: string; users: number }[]
	retention: { cohort: string; weeks: number[] }[]
}

export const audience = (days: number, channelName: string) => {
	const params = new URLSearchParams({ days: String(days) })

	if (channelName) params.set('channel', channelName)

	return api<Audience>(`/admin/audience?${params}`)
}

export const heads = (channelName: string) =>
	api<Head[]>(`/admin/channels/${encodeURIComponent(channelName)}`)

export const republishChannel = (
	channelName: string,
	target: {
		runtime_version: string
		platform: Platform
		group_id: string
		message: string
	},
) =>
	apiPost(
		`/admin/channels/${encodeURIComponent(channelName)}/republish`,
		target,
	)

export const setChannelEmbedded = (
	channelName: string,
	target: { runtime_version: string; platform: Platform; group_id: string },
) =>
	apiPost(`/admin/channels/${encodeURIComponent(channelName)}/embedded`, target)
