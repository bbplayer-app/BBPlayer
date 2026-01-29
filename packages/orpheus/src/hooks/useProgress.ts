import { useEffect, useState, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { Orpheus } from '../ExpoOrpheusModule'

type OrpheusSubscription = ReturnType<typeof Orpheus.addListener>

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
