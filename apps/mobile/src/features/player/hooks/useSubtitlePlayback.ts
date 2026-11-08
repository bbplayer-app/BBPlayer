import { Orpheus } from '@bbplayer/orpheus'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import type { SubtitleReaderStore } from '@/features/player/stores/subtitleReaderStore'
import { subtitleIndexAt } from '@/features/player/utils/subtitles'
import playerProgressEmitter from '@/lib/player/progressListener'

/** Update React only when the spoken cue changes, including seeks while paused. */
export function useSubtitlePlayback(
	store: SubtitleReaderStore,
	active: boolean,
) {
	const { lines } = store.content
	useEffect(() => {
		if (!active || !lines.length) return
		let disposed = false
		let revision = 0
		const update = (position: number) => {
			if (disposed) return
			const index = subtitleIndexAt(lines, position)
			store.setCurrentCue(index)
		}
		const sync = () => {
			const request = ++revision
			void Orpheus.getPosition()
				.then((position) => {
					if (request === revision) update(position)
				})
				.catch(() => undefined)
		}
		const unsubscribe = playerProgressEmitter.subscribe(
			'progress',
			({ position }) => {
				++revision
				if (AppState.currentState === 'active') update(position)
			},
		)
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'active') sync()
		})
		sync()
		return () => {
			disposed = true
			unsubscribe()
			subscription.remove()
		}
	}, [active, lines, store])
}
