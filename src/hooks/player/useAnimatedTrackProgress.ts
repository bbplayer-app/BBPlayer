import playerProgressEmitter from '@/lib/player/progressListener'
import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

/**
 * Reanimated shared values 版的 useTrackProgress
 * @param background: 如果为 false，应用进入后台时会停止接收事件；为 true 则一直接收。
 */
export default function useAnimatedTrackProgress(background = false) {
	const position = useSharedValue(0)
	const duration = useSharedValue(0)
	const isActive = useSharedValue(true)
	const buffered = useSharedValue(0)

	useEffect(() => {
		const appStateSubscription = AppState.addEventListener(
			'change',
			(nextAppState) => {
				if (nextAppState === 'active') {
					isActive.value = true
				}
			},
		)
		const handler = playerProgressEmitter.subscribe('progress', (data) => {
			if (isActive.value || background) {
				position.value = data.position
				duration.value = data.duration
				buffered.value = data.buffered
			}
		})
		return () => {
			handler()
			appStateSubscription.remove()
		}
	}, [isActive, position, duration, buffered, background])

	useEffect(() => {
		void Promise.all([
			Orpheus.getPosition(),
			Orpheus.getDuration(),
			Orpheus.getBuffered(),
		]).then(([pos, dur, buf]) => {
			position.set(pos)
			duration.set(dur)
			buffered.set(buf)
		})
	}, [buffered, duration, position])

	return { position, duration, buffered }
}
