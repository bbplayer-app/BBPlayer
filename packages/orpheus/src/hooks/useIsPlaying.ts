import { useState, useEffect } from 'react'

import { Orpheus } from '../ExpoOrpheusModule'

/**
 * 订阅原生播放/暂停变化，并返回当前是否正在播放。
 */
export function useIsPlaying() {
	const [isPlaying, setIsPlaying] = useState(false)

	useEffect(() => {
		let isMounted = true

		void Orpheus.getIsPlaying().then((val) => {
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
