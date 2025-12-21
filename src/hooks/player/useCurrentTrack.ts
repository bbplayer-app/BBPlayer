import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { effectToPromise } from '@/utils/effect'
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

			const handleFetchError = (e: unknown) => {
				if (isMounted && currentRequestId === lastRequestIdRef.current) {
					toastAndLogError('读取当前曲目信息失败', e, 'Hooks.useCurrentTrack')
					setTrack(null)
				}
			}

			let currentTrack
			try {
				currentTrack = await Orpheus.getCurrentTrack()
			} catch (e) {
				return handleFetchError(e)
			}

			if (!isMounted || currentRequestId !== lastRequestIdRef.current) {
				return
			}
			if (!currentTrack) {
				setTrack(null)
				return
			}

			let internalTrack
			try {
				internalTrack = await effectToPromise(
					trackService.getTrackByUniqueKey(currentTrack.id),
				)
			} catch (e) {
				setTrack(null)
				toastAndLogError('读取当前曲目信息失败', e, 'Hooks.useCurrentTrack')
				return
			}
			if (!isMounted || currentRequestId !== lastRequestIdRef.current) {
				return
			}
			setTrack(internalTrack)
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
