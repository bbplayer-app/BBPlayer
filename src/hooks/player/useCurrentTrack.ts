import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect, useRef, useState } from 'react'

export function useCurrentTrack() {
	const [track, setTrack] = useState<Track | null>(null)
	const lastRequestIdRef = useRef(0)

	useEffect(() => {
		let isMounted = true

		const fetchAndUpdate = async () => {
			const currentRequestId = ++lastRequestIdRef.current

			try {
				const currentTrack = await Orpheus.getCurrentTrack()
				if (!isMounted || currentRequestId !== lastRequestIdRef.current) {
					return
				}
				if (!currentTrack) {
					setTrack(null)
					return
				}
				const internalTrack = await trackService.getTrackByUniqueKey(
					currentTrack.id,
				)
				if (!isMounted || currentRequestId !== lastRequestIdRef.current) {
					return
				}
				if (internalTrack.isErr()) {
					setTrack(null)
					toastAndLogError(
						'读取当前曲目信息失败',
						internalTrack.error,
						'Hooks.useCurrentTrack',
					)
					return
				}
				setTrack(internalTrack.value)
			} catch (e) {
				if (isMounted && currentRequestId === lastRequestIdRef.current) {
					toastAndLogError('读取当前曲目信息失败', e, 'Hooks.useCurrentTrack')
					setTrack(null)
				}
			}
		}

		void fetchAndUpdate()

		const sub = Orpheus.addListener('onTrackStarted', () => {
			void fetchAndUpdate()
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [])

	return track
}

export default useCurrentTrack
