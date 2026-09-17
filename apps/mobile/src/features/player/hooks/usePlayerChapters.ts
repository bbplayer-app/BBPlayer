import { Orpheus } from '@bbplayer/orpheus'
import { useValue } from '@legendapp/state/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
	chapterIndexAt,
	normalizeChapters,
	type Chapter,
} from '@/features/player/utils/chapters'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import useTrackDuration from '@/hooks/player/useTrackProgress'
import { videoDataQueryKeys } from '@/hooks/queries/bilibili/video'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import playerProgressEmitter from '@/lib/player/progressListener'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export function usePlayerChapters() {
	const track = useCurrentTrack()
	const trackId = useCurrentTrackId()
	const mode = useValue(playbackContextStore$.context.mode)
	const nativeDuration = useTrackDuration()
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
	const duration = nativeDuration > 0 ? nativeDuration : (track?.duration ?? 0)
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

/**
 * Tracks chapter changes rather than every playback position. Keep this off
 * while the sheet is hidden: TrueSheet retains its React subtree after dismiss.
 */
export function useCurrentChapterIndex(chapters: Chapter[], enabled: boolean) {
	const [currentIndex, setCurrentIndex] = useState(-1)
	const currentIndexRef = useRef(currentIndex)

	useEffect(() => {
		if (!enabled) return

		let disposed = false
		const updateIndex = (position: number) => {
			if (disposed) return
			const nextIndex = chapterIndexAt(chapters, position)
			if (currentIndexRef.current === nextIndex) return
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
		}
		void Orpheus.getPosition()
			.then(updateIndex)
			.catch(() => undefined)
		const unsubscribe = playerProgressEmitter.subscribe(
			'progress',
			({ position }) => {
				updateIndex(position)
			},
		)

		return () => {
			disposed = true
			unsubscribe()
		}
	}, [chapters, currentIndexRef, enabled])

	return enabled ? currentIndex : -1
}
