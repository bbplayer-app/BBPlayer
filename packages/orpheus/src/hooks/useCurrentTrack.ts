import { useState, useEffect } from 'react'

import { type Track, Orpheus } from '../ExpoOrpheusModule'

/**
 * 订阅原生曲目开始事件，并暴露当前曲目和队列索引。
 */
export function useCurrentTrack() {
	const [track, setTrack] = useState<Track | null>(null)
	const [index, setIndex] = useState<number>(-1)

	const fetchTrack = async () => {
		try {
			const [currentTrack, currentIndex] = await Promise.all([
				Orpheus.getCurrentTrack(),
				Orpheus.getCurrentIndex(),
			])
			console.log(currentTrack)
			return { currentTrack, currentIndex }
		} catch (e) {
			console.warn('Failed to fetch current track', e)
			return { currentTrack: null, currentIndex: -1 }
		}
	}

	useEffect(() => {
		let isMounted = true

		void fetchTrack().then(({ currentTrack, currentIndex }) => {
			if (isMounted) {
				setTrack(currentTrack)
				setIndex(currentIndex)
			}
		})

		const sub = Orpheus.addListener('onTrackStarted', async () => {
			console.log('Track Started')
			const { currentTrack, currentIndex } = await fetchTrack()
			if (isMounted) {
				setTrack(currentTrack)
				setIndex(currentIndex)
			}
		})

		return () => {
			isMounted = false
			sub.remove()
		}
	}, [])

	return { track, index }
}
