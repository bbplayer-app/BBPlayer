import playerProgressEmitter from '@/lib/player/progressListener'
import * as Haptics from '@/utils/haptics'
import { Orpheus } from '@roitium/expo-orpheus'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

export function usePlayerSlider() {
	// 为了避免释放时闪烁
	const overridePosition = useSharedValue<number | null>(null)
	const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const sharedPosition = useSharedValue(0)
	const sharedDuration = useSharedValue(0)
	const isActive = useSharedValue(true)

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
			if (overridePosition.get() === null && isActive.value) {
				sharedPosition.set(data.position)
				sharedDuration.set(data.duration)
			}
		})
		return () => {
			handler()
			appStateSubscription.remove()
		}
	}, [isActive, overridePosition, sharedDuration, sharedPosition])

	useEffect(() => {
		void Promise.all([Orpheus.getPosition(), Orpheus.getDuration()]).then(
			([position, duration]) => {
				sharedPosition.set(position)
				sharedDuration.set(duration)
			},
		)
	}, [sharedDuration, sharedPosition])

	const handleSlidingStart = useCallback(
		(value: number) => {
			void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Drag_Start)
			overridePosition.set(value)
			if (resyncTimer.current) {
				clearTimeout(resyncTimer.current)
				resyncTimer.current = null
			}
		},
		[overridePosition],
	)

	const handleSlidingComplete = useCallback(
		async (value: number) => {
			void Haptics.performAndroidHapticsAsync(
				Haptics.AndroidHaptics.Gesture_End,
			)
			overridePosition.set(value)
			await Orpheus.seekTo(value)

			sharedPosition.set(value)

			resyncTimer.current = setTimeout(() => {
				overridePosition.set(null)
				resyncTimer.current = null
			}, 500)
		},
		[overridePosition, sharedPosition],
	)

	useEffect(() => {
		return () => {
			if (resyncTimer.current) {
				clearTimeout(resyncTimer.current)
				resyncTimer.current = null
			}
		}
	}, [])

	return {
		handleSlidingStart,
		handleSlidingComplete,
		sharedPosition,
		sharedDuration,
	}
}
