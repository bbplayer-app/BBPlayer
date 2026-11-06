import { Orpheus } from '@bbplayer/orpheus'
import { useValue } from '@legendapp/state/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useBilibiliPlayerInfo } from '@/features/player/hooks/useBilibiliPlayerInfo'
import {
	chapterIndexAt,
	normalizeChapters,
	type Chapter,
} from '@/features/player/utils/chapters'
import useTrackDuration from '@/hooks/player/useTrackProgress'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import playerProgressEmitter from '@/lib/player/progressListener'

export function usePlayerChapters() {
	const mode = useValue(playbackContextStore$.context.mode)
	const nativeDuration = useTrackDuration()
	const player = useBilibiliPlayerInfo(mode === 'podcast')
	const { track, trackId, enabled, info } = player
	const duration = nativeDuration > 0 ? nativeDuration : (track?.duration ?? 0)
	const chapters = useMemo(
		() => (enabled ? normalizeChapters(info.data?.view_points, duration) : []),
		[enabled, info.data?.view_points, duration],
	)
	return {
		podcast: mode === 'podcast',
		trackId,
		chapters,
		isLoading: player.isLoading,
		isError: player.isError,
		isLocal: track?.source === 'local',
		retry: player.retry,
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
