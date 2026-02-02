import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import playerProgressEmitter from '@/lib/player/progressListener'

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
				} else {
					isActive.value = false
				}
			},
		)
		const handler = playerProgressEmitter.subscribe('progress', (data) => {
			if (
				(isActive.value && AppState.currentState === 'active') ||
				background
			) {
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
		const fetchProgress = () => {
			void Promise.all([
				Orpheus.getPosition(),
				Orpheus.getDuration(),
				Orpheus.getBuffered(),
			]).then(([pos, dur, buf]) => {
				position.set(pos)
				duration.set(dur)
				buffered.set(buf)
			})
		}

		fetchProgress()

		// 监听曲目变化，重新获取进度信息
		const trackStartedSub = Orpheus.addListener('onTrackStarted', fetchProgress)

		return () => {
			trackStartedSub.remove()
		}
	}, [buffered, duration, position])

	return { position, duration, buffered }
}
