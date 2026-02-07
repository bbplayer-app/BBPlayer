import { Orpheus, registerOrpheusHeadlessTask } from '@roitium/expo-orpheus'

import useAppStore from './src/hooks/stores/useAppStore'
import { analyticsService } from './src/lib/services/analyticsService'
import log, { reportErrorToSentry } from './src/utils/log'
import {
	finalizeAndRecordCurrentTrack,
	setDesktopLyrics,
} from './src/utils/player'
import toast from './src/utils/toast'

global.isUIReady = false

Orpheus.addListener('onPlayerError', (error) => {
	log.error('播放器错误事件：', { error })
	if (global.isUIReady) {
		toast.error(`播放器发生错误: ${error.message || '未知错误'}`, {
			description: error.code,
		})
	}
	log.error('播放器错误事件：', { error })
	reportErrorToSentry(error, '播放器错误事件', 'Native.Player')
})

let lastResumedTime = 0
let totalPlayedTime = 0

registerOrpheusHeadlessTask(async (event) => {
	if (event.eventName === 'onTrackStarted') {
		lastResumedTime = Date.now()
		totalPlayedTime = 0
		setDesktopLyrics(event.trackId, event.reason)
	} else if (event.eventName === 'onTrackResumed') {
		lastResumedTime = Date.now()
	} else if (event.eventName === 'onTrackPaused') {
		if (lastResumedTime > 0) {
			const segment = (Date.now() - lastResumedTime) / 1000
			if (segment > 0) {
				totalPlayedTime += segment
			}
			lastResumedTime = 0
		}
	} else if (event.eventName === 'onTrackFinished') {
		// 如果在播放中结束（没经过 pause），补加上最后一段
		if (lastResumedTime > 0) {
			const segment = (Date.now() - lastResumedTime) / 1000
			if (segment > 0) {
				totalPlayedTime += segment
			}
			lastResumedTime = 0
		}

		// 过滤掉异常的短播放（例如 < 1秒）或异常长（例如系统时间回调错误）
		if (totalPlayedTime > 1 && totalPlayedTime < 86400) {
			const enableDataCollection =
				useAppStore.getState().settings.enableDataCollection ?? true
			if (enableDataCollection) {
				void analyticsService.logPlaybackSession(totalPlayedTime)
			}
		}
		totalPlayedTime = 0

		void finalizeAndRecordCurrentTrack(
			event.trackId,
			event.duration,
			event.finalPosition,
		)
	}
})

import 'expo-router/entry'
