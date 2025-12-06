import { Orpheus } from '@roitium/expo-orpheus'
import { useEffect, useState } from 'react'

export function useIsCurrentTrack(trackUniqueKey: string) {
	const [isCurrent, setIsCurrent] = useState(false)

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
			.then(({ currentTrack }) => {
				if (isMounted) {
					if (!currentTrack) {
						setIsCurrent(false)
						return
					}
					if (currentTrack.id === trackUniqueKey) {
						setIsCurrent(true)
					} else {
						setIsCurrent(false)
					}
				}
			})
			.catch(() => {
				// ignore
			})

		const sub = Orpheus.addListener('onTrackTransition', async () => {
			const { currentTrack } = await fetchTrack()
			if (isMounted) {
				if (!currentTrack) {
					setIsCurrent(false)
					return
				}
				if (currentTrack.id === trackUniqueKey) {
					setIsCurrent(true)
				} else {
					setIsCurrent(false)
				}
			}
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [trackUniqueKey])

	return isCurrent
}

export default useIsCurrentTrack
