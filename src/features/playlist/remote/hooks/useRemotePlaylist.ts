import type { BilibiliTrack } from '@/types/core/media'
import { addToQueue } from '@/utils/player'
import { useCallback } from 'react'

export function useRemotePlaylist() {
	const playTrack = useCallback((track: BilibiliTrack, playNext = false) => {
		void addToQueue({
			tracks: [track],
			playNow: !playNext,
			clearQueue: false,
			playNext: playNext,
			startFromKey: track.uniqueKey,
		})
	}, [])

	return { playTrack }
}
