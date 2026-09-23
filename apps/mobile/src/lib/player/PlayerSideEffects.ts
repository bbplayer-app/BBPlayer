import {
	Orpheus,
	registerOrpheusHeadlessTask,
	type PlaybackErrorEvent,
} from '@bbplayer/orpheus'
import { fetch as NetInfoFetch } from '@react-native-community/netinfo'
import { PermissionsAndroid, Platform } from 'react-native'

import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import log, { reportErrorToSentry } from '@/utils/log'
import { isActuallyOffline } from '@/utils/network'
import { finalizeAndRecordCurrentTrack } from '@/utils/player'
import toast from '@/utils/toast'

const logger = log.extend('Manager.PlayerSideEffects')

/**
 * 判断 ExoPlayer 错误码是否属于「用户 / 内容 / 设备侧」问题。
 *
 * 错误码定义见 androidx.media3 PlaybackException（本项目使用 1.9.0）：
 * https://github.com/androidx/media/blob/1.9.0/libraries/common/src/main/java/androidx/media3/common/PlaybackException.java
 *
 * 需要忽略（不是客户端缺陷，上报只会产生噪音）：
 * - 1002 直播窗口越界、1003 通用超时（瞬时 / 网络问题）
 * - 2xxx IO：网络、文件、服务端响应
 * - 3xxx 内容解析：媒体容器 / manifest
 * - 4xxx 解码：设备编解码能力或内容格式不受支持
 * - 5xxx AudioTrack：设备音频输出（音频 HAL / 声卡驱动）
 * - 6xxx DRM：内容侧（本项目不涉及 DRM）
 * - 7xxx 视频帧处理：纯音频应用不会触发
 * - -100 ~ -999 远端播放器断连、账号与内容限制
 *
 * 仍然上报（可能是本应用的调用 / 状态问题，值得排查）：
 * - -2 无效状态、-3 非法参数、-4 权限不足、-6 不支持的操作
 * - 1000 未知错误、1004 运行时检查失败
 * - >= 1000000 自定义错误码
 */
function isUserSidePlaybackErrorCode(errorCode: number): boolean {
	return (
		(errorCode >= 2000 && errorCode < 8000) ||
		errorCode === 1002 ||
		errorCode === 1003 ||
		(errorCode <= -100 && errorCode > -1000)
	)
}

class PlayerSideEffects {
	private initialized = false
	private isHandlingSpectrumVisualizerError = false

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
		this.setupSpectrumVisualizerErrorHandler()
	}

	/**
	 * 注册原生播放器 Headless Task
	 * 处理来自原生层的播放事件（如曲目开始、结束、歌词清空等）
	 */
	private registerHeadlessTask() {
		registerOrpheusHeadlessTask(async (event) => {
			if (event.eventName === 'onTrackStarted') {
				await lyricService.pushLyricsToOverlays(event.trackId)
			} else if (event.eventName === 'onTrackFinished') {
				await finalizeAndRecordCurrentTrack(
					event.trackId,
					event.duration,
					event.finalPosition,
				)
			} else if (event.eventName === 'onRequestClearLyrics') {
				// 桌面歌词面板「清空歌词」按钮被点击时，标记该曲目跳过歌词
				logger.info('收到清空歌词请求', { trackId: event.trackId })
				await lyricService.skipLyric(event.trackId)
				// 使 React Query 缓存失效，让歌词面板立即显示跳过提示
				// 使用 void 是因为软件在后台时不需要这个强制完成，可以等待到前台后再完成
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
		const errorCode = 'errorCode' in event ? event.errorCode : null

		if (rawMessage.includes('Bilibili API Error')) {
			const codeMatch = rawMessage.match(/code=(-?\d+)/)
			const msgMatch = rawMessage.match(/msg=(.+)/)
			const biliCode = codeMatch ? codeMatch[1] : 'Unknown'
			const msg = msgMatch ? msgMatch[1] : 'Unknown Error'

			if (biliCode === '-412') {
				return {
					message: 'Bilibili 触发验证码，请尝试重新登录或稍后再试',
					shouldReport: false,
				}
			}
			if (biliCode === '-101') {
				return { message: 'Bilibili 账号未登录', shouldReport: false }
			}
			return {
				message: `Bilibili API 错误: ${msg} (${biliCode})`,
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
				/resolve url failed|unknownhost|failed to connect|network is unreachable|unable to resolve host|no address associated with hostname/i

			// 2000-2999 是关于 IO 或 NETWORK 的问题。
			if (
				isActuallyOffline(networkState) &&
				errorCode &&
				errorCode >= 2000 &&
				errorCode < 3000
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

		// ponytail: network errors leaking from player native layer.
		// Grouped by pattern: connection-refused, DNS, SSL, timeout, socket, http.
		// If false positives appear, split into narrower patterns.
		if (
			rawMessage.includes('Unable to connect') ||
			rawMessage.includes('UnknownHostException') ||
			rawMessage.includes('ConnectException') ||
			rawMessage.includes('SocketTimeoutException') ||
			rawMessage.includes('EAI_NODATA') ||
			rawMessage.includes('ECONNREFUSED') ||
			rawMessage.includes('ECONNABORTED') ||
			rawMessage.includes('ETIMEDOUT') ||
			rawMessage.includes('EHOSTUNREACH') ||
			rawMessage.includes('EACCES') ||
			rawMessage.includes('Connection refused') ||
			rawMessage.includes('connection closed') ||
			rawMessage.includes('Connection reset') ||
			rawMessage.includes('Software caused connection abort') ||
			rawMessage.includes('Socket closed') ||
			rawMessage.includes('timed out') ||
			rawMessage.includes('Trust anchor') ||
			rawMessage.includes('Response code: 404') ||
			rawMessage.includes('No route to host') ||
			rawMessage.includes('failed to connect') ||
			rawMessage === 'timeout'
		) {
			return { message: '网络连接失败，请检查网络设置', shouldReport: false }
		}

		// 错误码落在「用户 / 内容 / 设备侧」分段，或为 ExoPlayer 的通用
		// 「Source error」（无 rootCause 时只能靠文案识别），一律不上报
		// Sentry（BBPLAYER-A5 / BBPLAYER-6P）
		if (
			(errorCode !== null && isUserSidePlaybackErrorCode(errorCode)) ||
			rawMessage.includes('Source error')
		) {
			return {
				message: '无法播放该音频，音源或设备可能暂不支持',
				shouldReport: false,
			}
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
		return new Error(event.error || 'Unknown playback error')
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

	private setupSpectrumVisualizerErrorHandler() {
		Orpheus.addListener('onSpectrumVisualizerError', (event) => {
			if (this.isHandlingSpectrumVisualizerError) return

			void (async () => {
				this.isHandlingSpectrumVisualizerError = true
				try {
					const hasPermission =
						Platform.OS !== 'android' ||
						(await PermissionsAndroid.check(
							PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
						))

					if (!hasPermission) {
						toast.info('未获得麦克风权限，已关闭频谱显示')
						return
					}

					toast.error('当前设备或音频输出不支持系统频谱分析，已关闭频谱显示', {
						description: event.message,
					})
				} catch (error) {
					logger.error('处理频谱初始化错误失败', { error, event })
				} finally {
					this.isHandlingSpectrumVisualizerError = false
				}
			})()
		})
	}
}

export const playerSideEffects = new PlayerSideEffects()
