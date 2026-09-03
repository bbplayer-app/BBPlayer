import { getToken, reportUnauthorized } from '@/lib/auth'

export type Group = {
	id: string
	channel: string
	runtime_version: string
	app_version: string
	message: string
	created_at: string
	fingerprint_hash?: string
	source: unknown
}
export type Runtime = {
	runtime_version: string
	version: string
	updated_at: string
	head_group_id?: string
	mode: string
	platforms: string[]
}
export type Detail = Group & {
	fingerprint_sources: unknown
	platforms: {
		id: string
		platform: 'android' | 'ios'
		launch_key: string
		launch_hash: string
		launch_size: number
		downloads: number
		known_launches: number
		known_crashes: number
	}[]
}
export type Asset = {
	id: number
	asset_key: string
	content_type: string
	size_bytes: number
	is_launch: boolean
	downloads: number
}
const base = import.meta.env.VITE_API_BASE_URL ?? ''
async function api<T>(path: string) {
	const token = getToken()
	const r = await fetch(base + path, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	})
	if (r.status === 401) {
		reportUnauthorized()
		throw new Error('Unauthorized')
	}
	if (!r.ok)
		throw new Error(`Request failed (${r.status})`)
	return r.json() as Promise<T>
}
export async function verifyToken(token: string) {
	const r = await fetch(base + '/admin/session', {
		headers: { Authorization: `Bearer ${token}` },
	})
	return r.ok
}
export const channels = () =>
	api<{ channel: string; updated_at: string; runtime_count: number }[]>(
		'/admin/dashboard/channels',
	)
export const channel = (v: string) =>
	api<{ channel: string; runtimes: Runtime[] }>(
		`/admin/dashboard/channels/${encodeURIComponent(v)}`,
	)
export const activity = (c: string, r: string) =>
	api<{
		series: { day: string; group_id?: string; active_installations: number }[]
	}>(
		`/admin/dashboard/channels/${encodeURIComponent(c)}/activity?runtime_version=${encodeURIComponent(r)}`,
	)
export const groups = () => api<Group[]>('/admin/updates?limit=100')
export type RuntimeSummary = {
	runtime_version: string
	version: string
	updated_at: string
	update_count: number
	channels: string[]
}
export const runtimes = () => api<RuntimeSummary[]>('/admin/dashboard/runtimes')
export const runtime = (value: string) =>
	api<{
		runtime_version: string
		version: string
		channels: string[]
		updates: Group[]
	}>(`/admin/dashboard/runtimes/${encodeURIComponent(value)}`)
export const detail = (id: string) =>
	api<Detail>(`/admin/dashboard/updates/${id}`)
export const assets = (id: string, p: string) =>
	api<Asset[]>(`/admin/dashboard/updates/${id}/platforms/${p}/assets`)
export const lifecycle = (id: string) =>
	api<{
		series: { day: string; known_launches: number; known_crashes: number }[]
	}>(`/admin/insights/groups/${id}/lifecycle`)
export const insights = () =>
	api<{
		summary: {
			unique_users: number
			update_checks: number
			downloads: number
			launches: number
			launch_successes: number
			launch_failures: number
			emergency_launches: number
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
