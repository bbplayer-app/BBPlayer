import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { ProjectScope } from '@/types/core/scope'
import { toastAndLogError } from '@/utils/error-handling'
import log, { reportErrorToSentry } from '@/utils/log'
import toast from '@/utils/toast'
import TrackPlayer, {
	Event,
	RepeatMode,
	State as TrackPlayerState,
} from 'react-native-track-player'

const logger = log.extend('Player.PlaybackService')
let isResettingSleepTimer = false
let listenersAttached = false

// eslint-disable-next-line @typescript-eslint/require-await -- startHeadlessTask 要求传入的函数必须返回一个 Promise
export const PlaybackService = async () => {
	if (listenersAttached) {
		logger.debug('事件监听器已经设置过了，跳过。')
		return
	}
	listenersAttached = true
	// 播放控制
	TrackPlayer.addEventListener(Event.RemotePlay, () => {
		if (usePlayerStore.getState().isPlaying) return
		void usePlayerStore.getState().togglePlay()
	})
	TrackPlayer.addEventListener(Event.RemotePause, () => {
		if (!usePlayerStore.getState().isPlaying) return
		void usePlayerStore.getState().togglePlay()
	})
	TrackPlayer.addEventListener(Event.RemoteNext, () => {
		void usePlayerStore.getState().skipToNext()
	})
	TrackPlayer.addEventListener(Event.RemotePrevious, () =>
		usePlayerStore.getState().skipToPrevious(),
	)

	// 跳转控制
	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
		void usePlayerStore.getState().seekTo(event.position)
	})

	// 停止控制
	TrackPlayer.addEventListener(Event.RemoteStop, () => {
		void usePlayerStore.getState().resetStore()
	})

	TrackPlayer.addEventListener(
		Event.PlaybackState,
		(data: { state: TrackPlayerState }) => {
			const { state } = data

			if (state === TrackPlayerState.Playing) {
				usePlayerStore.setState((state) => ({
					...state,
					isPlaying: true,
					isBuffering: false,
				}))
			} else if (
				state === TrackPlayerState.Paused ||
				state === TrackPlayerState.Stopped
			) {
				usePlayerStore.setState(() => ({
					isPlaying: false,
					isBuffering: false,
				}))
			} else if (
				state === TrackPlayerState.Buffering ||
				state === TrackPlayerState.Loading
			) {
				usePlayerStore.setState((state) => ({ ...state, isBuffering: true }))
			} else if (state === TrackPlayerState.Ready) {
				usePlayerStore.setState((state) => ({ ...state, isBuffering: false }))
			}
		},
	)

	// 监听播放完成
	TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
		const store = usePlayerStore.getState()
		const { repeatMode } = store

		logger.debug('播放队列结束（即单曲结束）', {
			repeatMode,
		})

		// 先记录当前曲目的播放记录（自然结束）
		await store._finalizeAndRecordCurrentPlay('ended')

		// 单曲结束后的行为
		if (repeatMode !== RepeatMode.Track) {
			await store.skipToNext()
		} else {
			await store.seekTo(0)
			await TrackPlayer.play()
			// 单曲循环：重置开始时间，用于下一次循环的统计
			usePlayerStore.setState((state) => ({
				...state,
				currentPlayStartAt: Date.now(),
			}))
		}
	})

	// 监听播放错误
	TrackPlayer.addEventListener(
		Event.PlaybackError,
		(data: { code: string; message: string }) => {
			if (
				data.code === 'android-io-bad-http-status' ||
				data.code === 'android-io-network-connection-failed'
			) {
				logger.debug('播放错误：服务器返回了错误状态码或加载失败')
				toast.error('播放错误：服务器返回了错误状态码或加载失败', {
					duration: Number.POSITIVE_INFINITY,
				})
				usePlayerStore.setState((state) => ({
					...state,
					isPlaying: false,
					isBuffering: false,
				}))
				return
			} else if (data.code === 'android-parsing-container-unsupported') {
				logger.error('播放错误：本地文件损坏')
				toast.error('播放错误：本地文件损坏，请重新下载或删除', {
					duration: Number.POSITIVE_INFINITY,
				})
				usePlayerStore.setState((state) => ({
					...state,
					isPlaying: false,
					isBuffering: false,
				}))
				return
			} else if (data.code === 'android-io-file-not-found') {
				logger.error('播放错误：本地文件不存在')
				toast.error('播放错误：本地文件不存在，你是否移动了文件？', {
					duration: Number.POSITIVE_INFINITY,
				})
				usePlayerStore.setState((state) => ({
					...state,
					isPlaying: false,
					isBuffering: false,
				}))
				return
			} else {
				logger.error('播放错误', data)
				toast.error(`播放错误: ${data.code} ${data.message}`, {
					duration: Number.POSITIVE_INFINITY,
				})
				reportErrorToSentry(
					new Error(`播放错误: ${data.code} ${data.message}`),
					'播放错误',
					ProjectScope.Player,
				)
				usePlayerStore.setState((state) => ({
					...state,
					isPlaying: false,
					isBuffering: false,
				}))
			}
			// const state = usePlayerStore.getState()
			// const nowTrack = state.currentTrackUniqueKey
			// 	? (state.tracks[state.currentTrackUniqueKey] ?? null)
			// 	: null
			// if (nowTrack) {
			// 	logger.debug('当前播放的曲目', {
			// 		trackId: nowTrack.id,
			// 		title: nowTrack.title,
			// 	})
			// 	const track = await usePlayerStore.getState().patchAudio(nowTrack)
			// 	if (track.isErr()) {
			// 		logger.error('更新音频流失败', track.error)
			// 		return
			// 	}
			// 	logger.debug('更新音频流成功', {
			// 		trackId: track.value.track.id,
			// 		title: track.value.track.title,
			// 	})
			// 	// 使用 load 方法替换当前曲目
			// 	const rntpTrack = convertToRNTPTrack(track.value.track)
			// 	if (rntpTrack.isErr()) {
			// 		logger.error('将 Track 转换为 RNTPTrack 失败', rntpTrack.error)
			// 		return
			// 	}
			// 	await TrackPlayer.load(rntpTrack.value)
			// }
		},
	)

	TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, () => {
		const { sleepTimerEndAt, setSleepTimer } = usePlayerStore.getState()

		if (
			sleepTimerEndAt &&
			Date.now() >= sleepTimerEndAt &&
			!isResettingSleepTimer
		) {
			isResettingSleepTimer = true
			logger.info('定时器时间到，暂停播放')
			setSleepTimer(null, true)
			void TrackPlayer.pause()
				.then(() => {
					toast.success('已根据您的设置自动暂停播放')
					usePlayerStore.setState((state) => ({
						...state,
						isPlaying: false,
						isBuffering: false,
					}))
					isResettingSleepTimer = false
				})
				.catch((error) => {
					toastAndLogError('定时时间到了，但暂停播放失败', error, 'Player')
					reportErrorToSentry(
						error,
						'定时时间到了，但暂停播放失败',
						ProjectScope.Player,
					)
					isResettingSleepTimer = false
					return
				})
		}
	})
}
