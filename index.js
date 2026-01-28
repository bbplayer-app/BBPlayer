import { Orpheus, registerOrpheusHeadlessTask } from '@roitium/expo-orpheus'
import log, { reportErrorToSentry } from './src/utils/log'
import {
	finalizeAndRecordCurrentTrack,
	setDesktopLyrics,
} from './src/utils/player'
import toast from './src/utils/toast'

// 定义一个全局变量，避免二次初始化 player
global.playerIsReady = false

Orpheus.addListener('onPlayerError', (error) => {
	log.error('播放器错误事件：', { error })
	toast.error(`播放器发生错误: ${error.message || '未知错误'}`, {
		description: error.code,
	})
	log.error('播放器错误事件：', { error })
	reportErrorToSentry(error, '播放器错误事件', 'Native.Player')
})

registerOrpheusHeadlessTask(async (event) => {
	if (event.eventName === 'onTrackStarted') {
		setDesktopLyrics(event.trackId, event.reason)
	} else if (event.eventName === 'onTrackFinished') {
		void finalizeAndRecordCurrentTrack(
			event.trackId,
			event.duration,
			event.finalPosition,
		)
	}
})

import 'expo-router/entry'
