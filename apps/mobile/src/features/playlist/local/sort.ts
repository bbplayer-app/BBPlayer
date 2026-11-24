import type { Track } from '@/types/core/media'

/**
 * 歌单页的「查看排序」。只影响展示与播放队列顺序，不会改写数据库中的 sort_key
 * （手动拖拽排序的结果与共享歌单的协作顺序保持不变）。
 */
export type PlaylistSortField = 'custom' | 'title' | 'artist' | 'duration'

export type PlaylistSortOrder = 'asc' | 'desc'

export type PlaylistSort = {
	field: PlaylistSortField
	order: PlaylistSortOrder
}

export const DEFAULT_PLAYLIST_SORT: PlaylistSort = {
	field: 'custom',
	order: 'asc',
}

export const PLAYLIST_SORT_FIELD_LABELS: Record<PlaylistSortField, string> = {
	custom: '自定义顺序',
	title: '标题',
	artist: '作者',
	duration: '时长',
}

export const PLAYLIST_SORT_ORDER_LABELS: Record<
	Exclude<PlaylistSortField, 'custom'>,
	Record<PlaylistSortOrder, string>
> = {
	title: { asc: 'A → Z', desc: 'Z → A' },
	artist: { asc: 'A → Z', desc: 'Z → A' },
	duration: { asc: '短 → 长', desc: '长 → 短' },
}

export const PLAYLIST_SORT_OPTIONS: readonly PlaylistSort[] = [
	DEFAULT_PLAYLIST_SORT,
	{ field: 'title', order: 'asc' },
	{ field: 'title', order: 'desc' },
	{ field: 'artist', order: 'asc' },
	{ field: 'artist', order: 'desc' },
	{ field: 'duration', order: 'asc' },
	{ field: 'duration', order: 'desc' },
]

export const getPlaylistSortId = (sort: PlaylistSort) =>
	`${sort.field}:${sort.order}`

/** 从持久化的字符串还原排序方式，无法识别时回退到自定义顺序 */
export const parsePlaylistSortId = (id: string | undefined): PlaylistSort =>
	PLAYLIST_SORT_OPTIONS.find((option) => getPlaylistSortId(option) === id) ??
	DEFAULT_PLAYLIST_SORT

export const getPlaylistSortLabel = (sort: PlaylistSort) =>
	sort.field === 'custom'
		? PLAYLIST_SORT_FIELD_LABELS.custom
		: `${PLAYLIST_SORT_FIELD_LABELS[sort.field]}（${PLAYLIST_SORT_ORDER_LABELS[sort.field][sort.order]}）`

export const isCustomSort = (sort: PlaylistSort) => sort.field === 'custom'

const collator = new Intl.Collator('zh-Hans-CN', {
	numeric: true,
	sensitivity: 'base',
})

/** 空字符串永远排在最后，不受正序 / 倒序影响 */
const compareText = (a: string, b: string, direction: number) => {
	if (!a || !b) return Number(!a) - Number(!b)

	return collator.compare(a, b) * direction
}

/**
 * 返回按指定方式排序后的新数组。排序是稳定的：比较结果相同时保留原（自定义）顺序。
 */
export function sortTracks(tracks: Track[], sort: PlaylistSort): Track[] {
	if (isCustomSort(sort)) return tracks

	const direction = sort.order === 'asc' ? 1 : -1

	const compare = (a: Track, b: Track): number => {
		switch (sort.field) {
			case 'title':
				return compareText(a.title, b.title, direction)
			case 'artist':
				return (
					compareText(a.artist?.name ?? '', b.artist?.name ?? '', direction) ||
					compareText(a.title, b.title, 1)
				)
			case 'duration':
				return ((a.duration ?? 0) - (b.duration ?? 0)) * direction
			default:
				return 0
		}
	}

	return tracks
		.map((track, index) => ({ track, index }))
		.sort((a, b) => compare(a.track, b.track) || a.index - b.index)
		.map(({ track }) => track)
}
