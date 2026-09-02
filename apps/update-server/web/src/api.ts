export type Group = {
	id: string
	channel: string
	runtime_version: string
	message: string
	created_at: string
	fingerprint_hash?: string
	source: unknown
}
export type Runtime = {
	runtime_version: string
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
const token = import.meta.env.VITE_ADMIN_TOKEN
async function api<T>(path: string) {
	const r = await fetch(base + path, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	})
	if (!r.ok)
		throw new Error(
			r.status === 401
				? 'Set VITE_ADMIN_TOKEN in apps/update-server/web/.env.local.'
				: `Request failed (${r.status})`,
		)
	return r.json() as Promise<T>
}
export const channels = () =>
	api<{ channel: string; updated_at: string; runtime_count: number }[]>(
		'/admin/dashboard/channels',
	)
export const channel = (v: string) =>
	api<{ channel: string; runtimes: Runtime[] }>(
		`/admin/dashboard/channels/${v}`,
	)
export const activity = (c: string, r: string) =>
	api<{
		series: { day: string; group_id?: string; active_installations: number }[]
	}>(`/admin/dashboard/channels/${c}/activity?runtime_version=${r}`)
export const groups = () => api<Group[]>('/admin/updates?limit=100')
export const detail = (id: string) =>
	api<Detail>(`/admin/dashboard/updates/${id}`)
export const assets = (id: string, p: string) =>
	api<Asset[]>(`/admin/dashboard/updates/${id}/platforms/${p}/assets`)
export const lifecycle = (id: string) =>
	api<{
		series: { day: string; known_launches: number; known_crashes: number }[]
	}>(`/admin/insights/groups/${id}/lifecycle`)
export const insights = () =>
	api<{ summary: { unique_users: number; downloads: number } }>(
		'/admin/insights',
	)
export const service = () =>
	api<{ series: { minute: string; requests: number; errors: number }[] }>(
		'/admin/metrics/service',
	)
