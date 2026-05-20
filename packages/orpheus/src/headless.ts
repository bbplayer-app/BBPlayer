import { AppRegistry, Platform } from 'react-native'

import { Orpheus, type OrpheusHeadlessEvent } from './ExpoOrpheusModule'

const ORPHEUS_HEADLESS_TASK = 'OrpheusHeadlessTask'

/**
 * 注册接收原生播放事件的后台任务。
 *
 * Android 会注册一个由 `OrpheusHeadlessTaskService` 消费的 React Native headless task。
 * iOS 这里没有原生 headless service，因此会在 JS 存活时从前台模块事件桥接到同一个回调。
 */
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

		Orpheus.addListener('onIsPlayingChanged', (event: { status: boolean }) => {
			task({
				eventName: event.status ? 'onTrackResumed' : 'onTrackPaused',
			}).catch((e) => console.error('[Orpheus] Headless task error:', e))
		})

		// 懒得管 ios 了
		// Orpheus.addListener(
		// 	'onRequestClearLyrics',
		// 	(event: { trackId: string }) => {
		// 		task({
		// 			eventName: 'onRequestClearLyrics',
		// 			...event,
		// 		}).catch((e) => console.error('[Orpheus] Headless task error:', e))
		// 	},
		// )
	}

	// On Android, the Headless Task Service handles this natively.
	if (Platform.OS === 'android') {
		AppRegistry.registerHeadlessTask(ORPHEUS_HEADLESS_TASK, () => task)
	}
}
