import { Orpheus, registerOrpheusHeadlessTask } from '@bbplayer/orpheus'
import { fetch as NetInfoFetch } from '@react-native-community/netinfo'

import { playerSideEffects } from './src/lib/player/PlayerSideEffects'
import lyricService from './src/lib/services/lyricService'
import log, { reportErrorToSentry } from './src/utils/log'
import { isActuallyOffline } from './src/utils/network'
import { finalizeAndRecordCurrentTrack } from './src/utils/player'
import toast from './src/utils/toast'

playerSideEffects.initialize()

registerOrpheusHeadlessTask(async (event) => {
	if (event.eventName === 'onTrackStarted') {
		lyricService.pushLyricsToOverlays(event.trackId)
	} else if (event.eventName === 'onTrackFinished') {
		void finalizeAndRecordCurrentTrack(
			event.trackId,
			event.duration,
			event.finalPosition,
		)
	}
})

const offlinePlaybackErrorPattern =
	/resolve url failed|unknownhost|failed to connect|network is unreachable|unable to resolve host/i

const getPlayerErrorInfo = async (event) => {
	const rawMessage = event.rootCauseMessage || event.message || ''
	const code = event.code || event.errorCode

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

	if (event.platform === 'android') {
		const networkState = await NetInfoFetch()
		const rootMessage = [
			event.rootCauseClass,
			event.rootCauseMessage,
			event.message,
			event.errorCodeName,
		]
			.filter(Boolean)
			.join(' ')

		// 2000-2999 是关于 IO 或 NETWORK 的问题。
		if (isActuallyOffline(networkState) && code >= 2000 && code < 3000) {
			return {
				message: '当前歌曲未缓存，离线状态下无法播放(或存在其他IO/网络问题)',
				shouldReport: false,
			}
		}

		if (
			isActuallyOffline(networkState) &&
			offlinePlaybackErrorPattern.test(rootMessage)
		) {
			return {
				message: '当前歌曲未缓存，离线状态下无法播放',
				shouldReport: false,
			}
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
		message: event.message || '播放器发生未知错误',
		shouldReport: true,
	}
}

const toSentryError = (event) => {
	if (event.platform === 'android') {
		return new Error(
			event.rootCauseMessage ||
				event.message ||
				event.errorCodeName ||
				'Unknown playback error',
		)
	}
	return new Error(event.error)
}

Orpheus.addListener('onPlayerError', async (event) => {
	log.error('播放器错误事件：', { event })

	let playerErrorInfo = {
		message: event.message || '播放器发生未知错误',
		shouldReport: true,
	}

	try {
		try {
			playerErrorInfo = await getPlayerErrorInfo(event)
		} catch (error) {
			log.error('解析播放器错误失败：', { error, event })
		}

		toast.error(playerErrorInfo.message, {
			description: event.code || event.errorCode,
		})

		if (playerErrorInfo.shouldReport) {
			reportErrorToSentry(
				toSentryError(event),
				'播放器错误事件',
				'Native.Player',
			)
		}
	} catch (error) {
		log.error('处理播放器错误事件失败：', { error, event })
	}
})

import 'expo-router/entry'
