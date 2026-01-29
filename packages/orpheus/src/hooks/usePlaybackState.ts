import { useEffect, useState } from 'react'

import { Orpheus, PlaybackState } from '../ExpoOrpheusModule'

export function usePlaybackState() {
	const [state, setState] = useState<PlaybackState>(PlaybackState.IDLE)

	useEffect(() => {
		let isMounted = true

		const sub = Orpheus.addListener('onPlaybackStateChanged', (event) => {
			if (isMounted) setState(event.state)
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [])

	return state
}
