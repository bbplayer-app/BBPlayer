import { Orpheus, registerOrpheusHeadlessTask } from '@bbplayer/orpheus'
import { registerRootComponent } from 'expo'

import LYRICS_DATA from '../bilibili--BV1DL4y1V7xH--584235509.json'

import App from './App'

registerOrpheusHeadlessTask(async (event) => {
	if (event.eventName === 'onTrackStarted') {
		if (event.trackId === 'bilibili--BV1DL4y1V7xH--584235509') {
			await Orpheus.setDesktopLyrics(JSON.stringify(LYRICS_DATA))
		}
	} else if (event.eventName === 'onTrackFinished') {
	}
})

registerRootComponent(App)
