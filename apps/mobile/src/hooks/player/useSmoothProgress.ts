import { Orpheus } from '@bbplayer/orpheus'
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
	const playbackSpeed = useSharedValue(1)
	const isAppActive = useSharedValue(true)

	useFrameCallback(
		useCallback(
			(frameInfo) => {
				'worklet'
				if (
					!isAppActive.value ||
					!isPlaying.value ||
					!frameInfo.timeSincePreviousFrame
				) {
					return
				}
				position.set(
					Math.min(
						duration.value || Infinity,
						position.value +
							(frameInfo.timeSincePreviousFrame / 1000) * playbackSpeed.value,
					),
				)
			},
			[isAppActive, isPlaying, position, duration, playbackSpeed],
		),
	)

	useEffect(() => {
		let disposed = false
		let syncRevision = 0
		const syncState = () => {
			const revision = ++syncRevision
			void Promise.all([
				Orpheus.getPosition(),
				Orpheus.getDuration(),
				Orpheus.getBuffered(),
				Orpheus.getIsPlaying(),
				Orpheus.getPlaybackSpeed(),
			])
				.then(([pos, dur, buf, playing, speed]) => {
					if (disposed || revision !== syncRevision) return
					playbackSpeed.set(speed)
					position.set(pos)
					duration.set(dur)
					buffered.set(buf)
					isPlaying.set(playing)
				})
				.catch(() => undefined)
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

		const stateSub = Orpheus.addListener('onPlaybackStateChanged', (_state) => {
			if (AppState.currentState !== 'active' && !background) return
			syncState()
		})

		const trackSub = Orpheus.addListener('onTrackStarted', syncState)
		const speedSub = Orpheus.addListener(
			'onPlaybackSpeedChanged',
			({ speed }) => playbackSpeed.set(speed),
		)

		const playingSub = Orpheus.addListener(
			'onIsPlayingChanged',
			({ status }) => {
				isPlaying.set(status)
				if (AppState.currentState !== 'active' && !background) return
				syncState()
			},
		)

		return () => {
			disposed = true
			speedSub.remove()
			progressSub()
			stateSub.remove()
			appStateSub.remove()
			trackSub.remove()
			playingSub.remove()
		}
	}, [
		isPlaying,
		position,
		duration,
		buffered,
		isAppActive,
		background,
		playbackSpeed,
	])

	return { position, duration, buffered }
}
