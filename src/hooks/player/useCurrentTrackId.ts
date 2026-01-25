import { toastAndLogError } from '@/utils/error-handling'
import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect, useRef, useState } from 'react'

export function useCurrentTrackId() {
	const [trackId, setTrackId] = useState<string | undefined>(undefined)
	const lastRequestIdRef = useRef(0)

	useEffect(() => {
		let isMounted = true

		const fetchAndUpdate = async () => {
			const currentRequestId = ++lastRequestIdRef.current

			let currentTrack
			try {
				currentTrack = await Orpheus.getCurrentTrack()
			} catch (e) {
				if (isMounted && currentRequestId === lastRequestIdRef.current) {
					toastAndLogError('读取当前曲目信息失败', e, 'Hooks.useCurrentTrackId')
					// Keep the last known trackId to prevent playback issues
				}
				return
			}

			if (!isMounted || currentRequestId !== lastRequestIdRef.current) {
				return
			}
			setTrackId(currentTrack?.id)
		}

		void fetchAndUpdate()

		const sub = Orpheus.addListener('onTrackStarted', () => {
			void fetchAndUpdate()
		})
		const sub2 = Orpheus.addListener('onTrackFinished', () => {
			void fetchAndUpdate()
		})

		return () => {
			isMounted = false
			sub.remove()
			sub2.remove()
		}
	}, [])

	return trackId
}

export default useCurrentTrackId
