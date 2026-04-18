import {
	Orpheus,
	registerOrpheusHeadlessTask,
	type PlaybackErrorEvent,
} from '@bbplayer/orpheus'
import { fetch as NetInfoFetch } from '@react-native-community/netinfo'

import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import log, { reportErrorToSentry } from '@/utils/log'
import { isActuallyOffline } from '@/utils/network'
import { finalizeAndRecordCurrentTrack } from '@/utils/player'
import toast from '@/utils/toast'

const logger = log.extend('Manager.PlayerSideEffects')

class PlayerSideEffects {
	private initialized = false

	public initialize() {
		if (this.initialized) return
		this.initialized = true

		logger.info('Initializing PlayerSideEffects')

		// 预加载功能完全没必要，当初那个鲨臂让我加的？？？？？
		// Orpheus.addListener('onTrackStarted', () => {
		// 	logger.debug('Track started, triggering side effects')
		// 	void lyricService.preloadNextTrackLyrics()
		// })

		// 注册原生播放器 headless task
		this.registerHeadlessTask()

		// 设置播放器错误处理
		this.setupErrorHandler()
	}

	/**
	 * 注册原生播放器 Headless Task
	 * 处理来自原生层的播放事件（如曲目开始、结束、歌词清空等）
	 */
	private registerHeadlessTask() {
		registerOrpheusHeadlessTask(async (event) => {
			if (event.eventName === 'onTrackStarted') {
				lyricService.pushLyricsToOverlays(event.trackId)
			} else if (event.eventName === 'onTrackFinished') {
				void finalizeAndRecordCurrentTrack(
					event.trackId,
					event.duration,
					event.finalPosition,
				)
			} else if (event.eventName === 'onRequestClearLyrics') {
				// 桌面歌词面板「清空歌词」按钮被点击时，标记该曲目跳过歌词
				logger.info('收到清空歌词请求', { trackId: event.trackId })
				await lyricService.skipLyric(event.trackId)
				// 使 React Query 缓存失效，让歌词面板立即显示跳过提示
				void queryClient.invalidateQueries({
					queryKey: lyricsQueryKeys.smartFetchLyrics(event.trackId),
				})
			}
		})
	}

	/**
	 * 解析播放器错误信息，返回友好的错误消息和是否需要上报 Sentry
	 */
	private async getPlayerErrorInfo(
		event: PlaybackErrorEvent,
	): Promise<{ message: string; shouldReport: boolean }> {
		// Android: rootCauseMessage, message, errorCode
		// iOS: error
		const rawMessage =
			('rootCauseMessage' in event ? event.rootCauseMessage : null) ||
			('message' in event ? event.message : null) ||
			''
		const code = 'errorCode' in event ? event.errorCode : null

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

			const offlinePlaybackErrorPattern =
				/resolve url failed|unknownhost|failed to connect|network is unreachable|unable to resolve host/i

			// 2000-2999 是关于 IO 或 NETWORK 的问题。
			if (
				isActuallyOffline(networkState) &&
				code &&
				code >= 2000 &&
				code < 3000
			) {
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
			message:
				('message' in event ? event.message : null) || '播放器发生未知错误',
			shouldReport: true,
		}
	}

	/**
	 * 将原生错误事件转换为 Sentry Error 对象
	 */
	private toSentryError(event: PlaybackErrorEvent): Error {
		if (event.platform === 'android') {
			return new Error(
				event.rootCauseMessage ||
					event.message ||
					event.errorCodeName ||
					'Unknown playback error',
			)
		}
		return new Error(String(event.error || 'Unknown playback error'))
	}

	/**
	 * 设置播放器错误监听处理
	 */
	private setupErrorHandler() {
		Orpheus.addListener('onPlayerError', async (event) => {
			logger.error('播放器错误事件：', { event })

			let playerErrorInfo = {
				message:
					('message' in event ? event.message : null) || '播放器发生未知错误',
				shouldReport: true,
			}

			try {
				try {
					playerErrorInfo = await this.getPlayerErrorInfo(event)
				} catch (error) {
					logger.error('解析播放器错误失败：', { error, event })
				}

				toast.error(playerErrorInfo.message, {
					description:
						'errorCode' in event ? String(event.errorCode) : undefined,
				})

				if (playerErrorInfo.shouldReport) {
					reportErrorToSentry(
						this.toSentryError(event),
						'播放器错误事件',
						'Native.Player',
					)
				}
			} catch (error) {
				logger.error('处理播放器错误事件失败：', { error, event })
			}
		})
	}
}

export const playerSideEffects = new PlayerSideEffects()
