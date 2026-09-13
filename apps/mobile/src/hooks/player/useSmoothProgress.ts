import { Orpheus } from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import {
	useFrameCallback,
	useSharedValue,
	type FrameInfo,
} from 'react-native-reanimated'

import { useDlnaCastStore } from '@/hooks/stores/useDlnaCastStore'
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

	const onFrame = useCallback(
		(frameInfo: FrameInfo) => {
			'worklet'
			if (
				!isAppActive.value ||
				!isPlaying.value ||
				!frameInfo.timeSincePreviousFrame
			) {
				return
			}
			position.set(position.value + frameInfo.timeSincePreviousFrame / 1000)
		},
		[isAppActive, isPlaying, position],
	)

	useFrameCallback(onFrame)

	const lastPositionRef = useRef(0)
	const lastPlayingRef = useRef(false)

	useEffect(() => {
		const applyDlna = () => {
			const s = useDlnaCastStore.getState()
			lastPositionRef.current = s.position
			lastPlayingRef.current = s.playing
			position.set(s.position)
			duration.set(s.duration)
			buffered.set(s.duration)
			isPlaying.set(s.playing)
		}

		const syncState = () => {
			if (useDlnaCastStore.getState().castingDevice) {
				applyDlna()
				return
			}
			void Promise.all([
				Orpheus.getPosition(),
				Orpheus.getDuration(),
				Orpheus.getBuffered(),
				Orpheus.getIsPlaying(),
			]).then(([pos, dur, buf, playing]) => {
				if (useDlnaCastStore.getState().castingDevice) return
				lastPositionRef.current = pos
				lastPlayingRef.current = playing
				position.set(pos)
				duration.set(dur)
				buffered.set(buf)
				isPlaying.set(playing)
			})
		}

		syncState()

		const dlnaUnsub = useDlnaCastStore.subscribe((s) => {
			if (!s.castingDevice) {
				syncState()
				return
			}
			duration.set(s.duration)
			buffered.set(s.duration)
			lastPlayingRef.current = s.playing
			isPlaying.set(s.playing)
			const diff = Math.abs(lastPositionRef.current - s.position)
			if (diff > 0.8 || !s.playing) {
				lastPositionRef.current = s.position
				position.set(s.position)
			}
		})

		const appStateSub = AppState.addEventListener('change', (nextAppState) => {
			const active = nextAppState === 'active'
			isAppActive.set(active)
			if (active) {
				syncState()
			}
		})

		const progressSub = playerProgressEmitter.subscribe('progress', (data) => {
			if (useDlnaCastStore.getState().castingDevice) return
			if (AppState.currentState !== 'active' && !background) return
			duration.set(data.duration)
			buffered.set(data.buffered)
			const diff = Math.abs(lastPositionRef.current - data.position)
			if (
				diff > 0.05 ||
				!lastPlayingRef.current ||
				AppState.currentState !== 'active'
			) {
				lastPositionRef.current = data.position
				position.set(data.position)
			}
		})

		const stateSub = Orpheus.addListener('onPlaybackStateChanged', (_state) => {
			if (useDlnaCastStore.getState().castingDevice) return
			if (AppState.currentState !== 'active' && !background) return
			syncState()
		})

		const trackSub = Orpheus.addListener('onTrackStarted', syncState)

		const playingSub = Orpheus.addListener(
			'onIsPlayingChanged',
			({ status }) => {
				if (useDlnaCastStore.getState().castingDevice) return
				lastPlayingRef.current = status
				isPlaying.set(status)
				if (AppState.currentState !== 'active' && !background) return
				syncState()
			},
		)

		return () => {
			dlnaUnsub()
			progressSub()
			stateSub.remove()
			appStateSub.remove()
			trackSub.remove()
			playingSub.remove()
		}
	}, [isPlaying, position, duration, buffered, isAppActive, background])

	return { position, duration, buffered, isPlaying }
}
