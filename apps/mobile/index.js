import { Orpheus, registerOrpheusHeadlessTask } from '@bbplayer/orpheus'

import useAppStore from './src/hooks/stores/useAppStore'
import { analyticsService } from './src/lib/services/analyticsService'
import log, { reportErrorToSentry } from './src/utils/log'
import {
	finalizeAndRecordCurrentTrack,
	setDesktopLyrics,
} from './src/utils/player'
import toast from './src/utils/toast'

global.isUIReady = false

const parsePlayerError = (error) => {
	const rawMessage = error.rootCauseMessage || error.message || ''

	if (rawMessage.includes('Bilibili API Error')) {
		const codeMatch = rawMessage.match(/code=(-?\d+)/)
		const msgMatch = rawMessage.match(/msg=(.+)/)
		const code = codeMatch ? codeMatch[1] : 'Unknown'
		const msg = msgMatch ? msgMatch[1] : 'Unknown Error'

		if (code === '-412') {
			return {
				message: 'Bilibili 触发验证码，请尝试重新登录或稍后再试',
				shouldReport: false,
			}
		}
		if (code === '-101') {
			return { message: 'Bilibili 账号未登录', shouldReport: false }
		}

		return {
			message: `Bilibili API 错误: ${msg} (${code})`,
			shouldReport: false,
		}
	}

	if (rawMessage.includes('Bilibili API Logic Error')) {
		return {
			message: 'Bilibili 数据解析失败，请检查网络或稍后再试',
			shouldReport: false,
		}
	}

	if (rawMessage.includes('AudioStreamError')) {
		return {
			message: '无法获取音频流，可能需要大会员或该歌曲已下架',
			shouldReport: false,
		}
	}

	if (rawMessage.includes('Bilibili API Http Error')) {
		const codeMatch = rawMessage.match(/Http Error: (\d+)/)
		return {
			message: `Bilibili 网络请求失败: ${codeMatch ? codeMatch[1] : 'Unknown'}`,
			shouldReport: false,
		}
	}

	if (
		rawMessage.includes('Unable to connect') ||
		rawMessage.includes('UnknownHostException') ||
		rawMessage.includes('ConnectException') ||
		rawMessage.includes('SocketTimeoutException')
	) {
		return { message: '网络连接失败，请检查网络设置', shouldReport: false }
	}

	return {
		message: error.message || '播放器发生未知错误',
		shouldReport: true,
	}
}

Orpheus.addListener('onPlayerError', (error) => {
	log.error('播放器错误事件：', { error })
	const { message, shouldReport } = parsePlayerError(error)

	if (global.isUIReady) {
		toast.error(message, {
			description: error.code,
		})
	}

	if (shouldReport) {
		reportErrorToSentry(error, '播放器错误事件', 'Native.Player')
	}
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
