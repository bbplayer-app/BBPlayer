import { Orpheus } from '@roitium/expo-orpheus'
import log from './src/utils/log'
import { finalizeAndRecordCurrentTrack } from './src/utils/player'
import toast from './src/utils/toast'

// 定义一个全局变量，避免二次初始化 player
global.playerIsReady = false

Orpheus.addListener('onPlayerError', (error) => {
	log.error('播放器错误事件：', { error })
	toast.error(`播放器发生错误: ${error.message || '未知错误'}`, {
		description: error.code,
	})
})

Orpheus.addListener('onTrackFinished', (event) => {
	void finalizeAndRecordCurrentTrack(
		event.trackId,
		event.duration,
		event.finalPosition,
	)
})

Orpheus.addListener('onTrackStarted', (event) => {
	log.debug('onTrackStarted', event)
})

import 'expo-router/entry'
