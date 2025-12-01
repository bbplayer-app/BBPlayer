import playerProgressEmitter from '@/lib/player/progressListener'
import TrackPlayer from '@roitium/react-native-track-player'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

interface Progress {
	position: number
	duration: number
	buffered: number
}

const INITIAL: Progress = { position: 0, duration: 0, buffered: 0 }

/**
 * 基于事件的监听音频播放进度
 * @param background: 如果为 false，应用进入后台时会停止接收事件；为 true 则一直接收。
 */
export default function useTrackProgress(background = false) {
	const [state, setState] = useState<Progress>(INITIAL)
	const mountedRef = useRef(true)
	const trackSubRef = useRef<(() => void) | null>(null)
	const appSubRef = useRef<{ remove?: () => void } | null>(null)

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	const addTrackListener = () => {
		if (trackSubRef.current) return
		const handler = (e: Progress) => {
			if (!mountedRef.current) return
			setState((prev) =>
				prev.position === e.position &&
				prev.duration === e.duration &&
				prev.buffered === e.buffered
					? prev
					: {
							position: e.position,
							duration: e.duration,
							buffered: e.buffered,
						},
			)
		}
		trackSubRef.current = playerProgressEmitter.subscribe('progress', handler)
	}

	const removeTrackListener = () => {
		trackSubRef.current?.()
		trackSubRef.current = null
	}

	useEffect(() => {
		const handleAppState = (next: string) => {
			if (next === 'active') {
				addTrackListener()

				void (async () => {
					try {
						const p = await TrackPlayer.getProgress()
						if (!mountedRef.current) return
						setState((prev) =>
							prev.position === p.position &&
							prev.duration === p.duration &&
							prev.buffered === p.buffered
								? prev
								: p,
						)
					} catch {
						// ignore
					}
				})()
			} else {
				if (!background) removeTrackListener()
			}
		}

		const appSub = AppState.addEventListener('change', handleAppState)
		appSubRef.current = appSub

		if (background || AppState.currentState === 'active') {
			addTrackListener()

			void (async () => {
				try {
					const p = await TrackPlayer.getProgress()
					if (!mountedRef.current) return
					setState((prev) =>
						prev.position === p.position &&
						prev.duration === p.duration &&
						prev.buffered === p.buffered
							? prev
							: p,
					)
				} catch {
					// ignore
				}
			})()
		}

		return () => {
			removeTrackListener()
			appSubRef.current?.remove?.()
		}
	}, [background])

	return state
}
