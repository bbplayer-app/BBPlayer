import { AppRegistry, Platform } from 'react-native'

import { Orpheus, type OrpheusHeadlessEvent } from './ExpoOrpheusModule'

const ORPHEUS_HEADLESS_TASK = 'OrpheusHeadlessTask'

export function registerOrpheusHeadlessTask(
	task: (event: OrpheusHeadlessEvent) => Promise<void>,
) {
	// On iOS, we bridge events from the Native Module to the headless task logic.
	if (Platform.OS === 'ios') {
		Orpheus.addListener('onTrackStarted', (event) => {
			task({
				eventName: 'onTrackStarted',
				...event,
			}).catch((e) => console.error('[Orpheus] Headless task error:', e))
		})

		Orpheus.addListener('onTrackFinished', (event) => {
			task({
				eventName: 'onTrackFinished',
				...event,
			}).catch((e) => console.error('[Orpheus] Headless task error:', e))
		})
	}

	// On Android, the Headless Task Service handles this natively.
	if (Platform.OS === 'android') {
		AppRegistry.registerHeadlessTask(ORPHEUS_HEADLESS_TASK, () => task)
	}
}
