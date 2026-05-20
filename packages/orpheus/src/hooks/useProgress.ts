import { useEffect, useState, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { Orpheus } from '../ExpoOrpheusModule'

type OrpheusSubscription = ReturnType<typeof Orpheus.addListener>

/**
 * 跟踪播放位置、曲目时长和缓冲位置，单位均为秒。
 *
 * App 处于前台时监听原生进度事件；回到前台时会主动向原生同步一次最新进度。
 */
export function useProgress() {
	const [progress, setProgress] = useState({
		position: 0,
		duration: 0,
		buffered: 0,
	})

	const listenerRef = useRef<null | OrpheusSubscription>(null)

	const startListening = () => {
		if (listenerRef.current) return

		listenerRef.current = Orpheus.addListener('onPositionUpdate', (event) => {
			setProgress({
				position: event.position,
				duration: event.duration,
				buffered: event.buffered,
			})
		})
	}

	const stopListening = () => {
		if (listenerRef.current) {
			listenerRef.current.remove()
			listenerRef.current = null
		}
	}

	const manualSync = () => {
		Promise.all([
			Orpheus.getPosition(),
			Orpheus.getDuration(),
			Orpheus.getBuffered(),
		])
			.then(([pos, dur, buf]) => {
				setProgress(() => ({
					position: pos,
					duration: dur,
					buffered: buf,
				}))
			})
			.catch((e) => console.warn('同步最新进度失败', e))
	}

	useEffect(() => {
		manualSync()
		startListening()

		const subscription = AppState.addEventListener(
			'change',
			(nextAppState: AppStateStatus) => {
				if (nextAppState === 'active') {
					manualSync()
					startListening()
				} else {
					stopListening()
				}
			},
		)

		return () => {
			stopListening()
			subscription.remove()
		}
	}, [])

	return progress
}
