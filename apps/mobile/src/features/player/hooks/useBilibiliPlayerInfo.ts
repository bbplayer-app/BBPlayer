import { useQuery } from '@tanstack/react-query'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import { videoDataQueryKeys } from '@/hooks/queries/bilibili/video'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

/** Shared CID resolution and player metadata for chapters and subtitles. */
export function useBilibiliPlayerInfo(active: boolean) {
	const track = useCurrentTrack()
	const trackId = useCurrentTrackId()

	const metadata =
		track && track.uniqueKey === trackId && track.source === 'bilibili'
			? track.bilibiliMetadata
			: undefined

	const enabled = active && !!metadata

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

	const waitingForCid =
		enabled && !metadata?.isMultiPage && pages.isPending && !pages.isPaused

	return {
		track,
		trackId,
		metadata,
		cid,
		enabled,
		info,
		isLoading:
			waitingForCid || (enabled && !!cid && info.isPending && !info.isPaused),
		isError:
			enabled &&
			((!metadata?.isMultiPage && (pages.isError || pages.isPaused)) ||
				(!!cid && (info.isError || info.isPaused))),
		retry: async () => {
			if (!metadata?.isMultiPage && (!cid || pages.isError || pages.isPaused))
				await pages.refetch()
			else if (cid) await info.refetch()
		},
	}
}
