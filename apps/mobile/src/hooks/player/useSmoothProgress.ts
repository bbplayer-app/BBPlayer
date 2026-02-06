import { Orpheus } from '@roitium/expo-orpheus'
import { useCallback, useEffect } from 'react'
import { AppState } from 'react-native'
import { useFrameCallback, useSharedValue } from 'react-native-reanimated'

import playerProgressEmitter from '@/lib/player/progressListener'

/**
 * 获取平滑的播放进度 (SharedValue)
 *
 * @param background 是否在后台保持监听事件更新（默认 false）
 */
export default function useSmoothProgress(background = false) {
	const position = useSharedValue(0)
	const duration = useSharedValue(0)
	const buffered = useSharedValue(0)
	const isPlaying = useSharedValue(false)
	const isAppActive = useSharedValue(true)

	useFrameCallback(
		useCallback(
			(frameInfo) => {
				if (
					!isAppActive.value ||
					!isPlaying.value ||
					!frameInfo.timeSincePreviousFrame
				) {
					return
				}
				position.value =
					position.value + frameInfo.timeSincePreviousFrame / 1000
			},
			[isAppActive, isPlaying, position],
		),
	)

	useEffect(() => {
		const syncState = () => {
			void Promise.all([
				Orpheus.getPosition(),
				Orpheus.getDuration(),
				Orpheus.getBuffered(),
				Orpheus.getIsPlaying(),
			]).then(([pos, dur, buf, playing]) => {
				position.set(pos)
				duration.set(dur)
				buffered.set(buf)
				isPlaying.set(playing)
			})
		}

		syncState()

		const appStateSub = AppState.addEventListener('change', (nextAppState) => {
			const active = nextAppState === 'active'
			isAppActive.set(active)
			if (active) {
				syncState()
			}
		})

		const progressSub = playerProgressEmitter.subscribe('progress', (data) => {
			if (AppState.currentState !== 'active' && !background) return
			duration.set(data.duration)
			buffered.set(data.buffered)
			const diff = Math.abs(position.value - data.position)
			if (
				diff > 0.05 ||
				!isPlaying.value ||
				AppState.currentState !== 'active'
			) {
				position.set(data.position)
			}
		})

		const stateSub = Orpheus.addListener('onPlaybackStateChange', (_state) => {
			if (AppState.currentState !== 'active' && !background) return
			syncState()
		})

		const trackSub = Orpheus.addListener('onTrackStarted', syncState)

		const playingSub = Orpheus.addListener(
			'onIsPlayingChanged',
			({ status }) => {
				isPlaying.set(status)
				if (AppState.currentState !== 'active' && !background) return
				syncState()
			},
		)

		return () => {
			progressSub()
			stateSub.remove()
			appStateSub.remove()
			trackSub.remove()
			playingSub.remove()
		}
	}, [isPlaying, position, duration, buffered, isAppActive, background])

	return { position, duration, buffered }
}
