import { useState, useEffect } from 'react'

import { Orpheus } from '../ExpoOrpheusModule'

export function useIsPlaying() {
	const [isPlaying, setIsPlaying] = useState(false)

	useEffect(() => {
		let isMounted = true

		Orpheus.getIsPlaying().then((val) => {
			if (isMounted) setIsPlaying(val)
		})

		const sub = Orpheus.addListener('onIsPlayingChanged', (event) => {
			if (isMounted) setIsPlaying(event.status)
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [])

	return isPlaying
}
