import { useEffect, useState } from 'react'

import { Orpheus, PlaybackState } from '../ExpoOrpheusModule'

/**
 * 订阅原生播放状态事件，并返回最新的 Media3 风格播放状态。
 */
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
