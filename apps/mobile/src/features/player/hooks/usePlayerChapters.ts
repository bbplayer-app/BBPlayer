import { useValue } from '@legendapp/state/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { normalizeChapters } from '@/features/player/utils/chapters'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import useTrackProgress from '@/hooks/player/useTrackProgress'
import { videoDataQueryKeys } from '@/hooks/queries/bilibili/video'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export function usePlayerChapters() {
	const track = useCurrentTrack()
	const trackId = useCurrentTrackId()
	const mode = useValue(playbackContextStore$.context.mode)
	const progress = useTrackProgress()
	const metadata =
		track && track.uniqueKey === trackId && track.source === 'bilibili'
			? track.bilibiliMetadata
			: undefined
	const enabled = mode === 'podcast' && !!metadata
	// Ordinary video playback resolves its first CID in the native stream resolver too.
	const pages = useQuery({
		queryKey: videoDataQueryKeys.getMultiPageList(metadata?.bvid),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(
				bilibiliApi.getPageList({ bvid: metadata!.bvid, signal }),
			),
		enabled: enabled && !metadata?.isMultiPage,
		staleTime: 60 * 60 * 1000,
		retry: 1,
		meta: { silent: true },
	})
	const cid = metadata?.isMultiPage
		? (metadata.cid ?? undefined)
		: pages.data?.[0]?.cid
	const info = useQuery({
		queryKey: videoDataQueryKeys.getWebPlayerInfo(metadata?.bvid, cid),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(
				bilibiliApi.getWebPlayerInfo({
					bvid: metadata!.bvid,
					cid: cid!,
					signal,
				}),
			),
		enabled: enabled && !!cid,
		staleTime: 5 * 60 * 1000,
		retry: 1,
		meta: { silent: true },
	})
	const duration =
		progress.duration > 0 ? progress.duration : (track?.duration ?? 0)
	const chapters = useMemo(
		() => (enabled ? normalizeChapters(info.data?.view_points, duration) : []),
		[enabled, info.data?.view_points, duration],
	)
	const waitingForCid =
		enabled && !metadata?.isMultiPage && pages.isPending && !pages.isPaused
	return {
		podcast: mode === 'podcast',
		trackId,
		chapters,
		duration,
		position: progress.position,
		isLoading:
			waitingForCid || (enabled && !!cid && info.isPending && !info.isPaused),
		isError:
			enabled &&
			((!metadata?.isMultiPage && (pages.isError || pages.isPaused)) ||
				(!!cid && (info.isError || info.isPaused))),
		isLocal: track?.source === 'local',
		retry: async () => {
			if (!metadata?.isMultiPage && (!cid || pages.isError))
				await pages.refetch()
			else if (cid) await info.refetch()
		},
	}
}
