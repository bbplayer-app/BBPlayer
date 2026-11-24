import { useCallback, useMemo } from 'react'
import { useMMKVString } from 'react-native-mmkv'

import {
	getPlaylistSortId,
	type PlaylistSort,
	parsePlaylistSortId,
} from '@/features/playlist/local/sort'
import { mmkv } from '@/utils/mmkv-instance'

/** 每个歌单单独记住自己的排序方式 */
export function usePlaylistSort(playlistId: number) {
	const [storedId, setStoredId] = useMMKVString(
		`playlist_sort_${playlistId}`,
		mmkv,
	)

	const sort = useMemo(() => parsePlaylistSortId(storedId), [storedId])

	const setSort = useCallback(
		(next: PlaylistSort) => {
			// 自定义顺序为默认值，直接删除记录
			setStoredId(next.field === 'custom' ? undefined : getPlaylistSortId(next))
		},
		[setStoredId],
	)

	return [sort, setSort] as const
}
