import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect, useState } from 'react'

export function useCurrentTrack() {
	const [track, setTrack] = useState<Track | null>(null)

	const fetchTrack = async () => {
		try {
			const currentTrack = await Orpheus.getCurrentTrack()
			return { currentTrack }
		} catch (e) {
			console.warn('Failed to fetch current track', e)
			return { currentTrack: null }
		}
	}

	useEffect(() => {
		let isMounted = true

		fetchTrack()
			.then(async ({ currentTrack }) => {
				if (isMounted) {
					if (!currentTrack) {
						setTrack(null)
						return
					}
					const internalTrack = await trackService.getTrackByUniqueKey(
						currentTrack.id,
					)
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
				}
			})
			.catch(() => {
				// ignore
			})

		const sub = Orpheus.addListener('onTrackStarted', async () => {
			const { currentTrack } = await fetchTrack()
			if (isMounted) {
				if (!currentTrack) {
					setTrack(null)
					return
				}
				const internalTrack = await trackService.getTrackByUniqueKey(
					currentTrack.id,
				)
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
			}
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [])

	return track
}

export default useCurrentTrack
