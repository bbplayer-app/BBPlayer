import { Orpheus, registerOrpheusHeadlessTask } from '@bbplayer/orpheus'
import { registerRootComponent } from 'expo'

import LYRICS_DATA from '../bilibili--BV1DL4y1V7xH--584235509.json'

import App from './App'

console.log('1111')

registerOrpheusHeadlessTask(async (event) => {
	console.log('hey we are here.')
	if (event.eventName === 'onTrackStarted') {
		console.log(
			'[OrpheusHeadlessTask] Track Started:',
			event.trackId,
			event.reason,
		)
		if (event.trackId === 'bilibili--BV1DL4y1V7xH--584235509') {
			await Orpheus.setDesktopLyrics(JSON.stringify(LYRICS_DATA))
		}
	} else if (event.eventName === 'onTrackFinished') {
		console.log(
			'[OrpheusHeadlessTask] Track Finished:',
			event.trackId,
			'Position:',
			event.finalPosition,
			'Duration:',
			event.duration,
		)
	}
})

registerRootComponent(App)
