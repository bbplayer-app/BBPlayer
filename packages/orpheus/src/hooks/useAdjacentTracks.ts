import { useState, useLayoutEffect, useCallback } from 'react'

import { type Track, Orpheus } from '../ExpoOrpheusModule'

import { useCurrentTrack } from './useCurrentTrack'

export function useAdjacentTracks() {
	const currentTrack = useCurrentTrack()
	const [adjacent, setAdjacent] = useState<{
		previous: Track | null
		next: Track | null
	}>({ previous: null, next: null })
	const refresh = useCallback(() => {
		void Orpheus.getAdjacentTracks().then(setAdjacent)
	}, [])

	useLayoutEffect(() => {
		refresh()
	}, [currentTrack.track?.id, refresh])

	return { adjacent, refresh }
}
