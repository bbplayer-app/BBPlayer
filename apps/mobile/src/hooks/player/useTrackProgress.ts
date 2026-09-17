import { Orpheus } from '@bbplayer/orpheus'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import playerProgressEmitter from '@/lib/player/progressListener'

/**
 * 订阅音频时长。播放位置更新不会改变返回值，因此不会把高频 position
 * 事件扩散成 React render。
 */
export function useTrackDuration(background = false) {
	const [duration, setDuration] = useState(0)
	const durationRef = useRef(duration)

	useEffect(() => {
		let disposed = false
		let progressSub: (() => void) | undefined

		const updateDuration = (nextDuration: number) => {
			if (disposed || durationRef.current === nextDuration) return
			durationRef.current = nextDuration
			setDuration(nextDuration)
		}
		const syncDuration = () => {
			void Orpheus.getDuration()
				.then(updateDuration)
				.catch(() => undefined)
		}
		const subscribe = () => {
			if (progressSub) return
			progressSub = playerProgressEmitter.subscribe(
				'progress',
				({ duration: nextDuration }) => {
					updateDuration(nextDuration)
				},
			)
			syncDuration()
		}
		const unsubscribe = () => {
			progressSub?.()
			progressSub = undefined
		}

		const appSub = AppState.addEventListener('change', (nextState) => {
			if (nextState === 'active') subscribe()
			else if (!background) unsubscribe()
		})

		if (background || AppState.currentState === 'active') subscribe()

		return () => {
			disposed = true
			unsubscribe()
			appSub.remove()
		}
	}, [background, durationRef])

	return duration
}

export default useTrackDuration
