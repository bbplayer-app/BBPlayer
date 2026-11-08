import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useBilibiliPlayerInfo } from '@/features/player/hooks/useBilibiliPlayerInfo'
import {
	selectSubtitle,
	subtitleLines,
} from '@/features/player/utils/subtitles'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { BilibiliSubtitleTrack } from '@/types/apis/bilibili'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export function usePlayerSubtitles(active: boolean) {
	const player = useBilibiliPlayerInfo(active)
	const preferredLanguage = useAppStore(
		(state) => state.settings.podcastSubtitleLanguage,
	)
	const [selection, setSelection] = useState<{ key: string; id: string }>()
	const key = `${player.metadata?.bvid}:${player.cid}`
	const tracks = useMemo(
		() =>
			(player.metadata
				? (player.info.data?.subtitle?.subtitles ?? [])
				: []
			).filter((track) => !!track.subtitle_url),
		[player.metadata, player.info.data],
	)
	const selected =
		(selection?.key === key
			? tracks.find(
					(track) => (track.id_str ?? String(track.id)) === selection.id,
				)
			: undefined) ?? selectSubtitle(tracks, preferredLanguage)
	const url = selected?.subtitle_url
	const content = useQuery({
		queryKey: ['bilibili', 'subtitles', player.metadata?.bvid, player.cid, url],
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getSubtitle({ url: url ?? '', signal })),
		enabled: active && player.enabled && !!url,
		staleTime: 5 * 60 * 1000,
		retry: 1,
		meta: { silent: true },
	})
	const lines = useMemo(() => subtitleLines(content.data), [content.data])
	return {
		key,
		tracks,
		selected,
		lines,
		trackId: player.trackId,
		title: player.track?.title ?? 'B 站字幕',
		isLocal: player.track?.source === 'local',
		isLoading:
			player.isLoading || (!!url && content.isPending && !content.isPaused),
		isError: player.isError || (!!url && (content.isError || content.isPaused)),
		select: (track: BilibiliSubtitleTrack) => {
			setSelection({ key, id: track.id_str ?? String(track.id) })
			useAppStore.getState().setSettings({ podcastSubtitleLanguage: track.lan })
		},
		retry: async () => {
			// Refresh signed URLs as well as the subtitle body when retrying.
			await player.retry()
			if (url) await content.refetch()
		},
	}
}
