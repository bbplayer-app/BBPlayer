import { ProjectScope } from '@/types/core/scope'
import log, { reportErrorToSentry } from '@/utils/log'
import TrackPlayer, {
	AppKilledPlaybackBehavior,
	Capability,
	RepeatMode,
} from 'react-native-track-player'

const logger = log.extend('Player.Init')

const initPlayer = async () => {
	logger.info('开始初始化播放器')
	await PlayerLogic.preparePlayer()
	// 初始化后强制将 RNTP 重复模式设为 Off，循环由我们内部管理
	await TrackPlayer.setRepeatMode(RepeatMode.Off)
	global.playerIsReady = true
	logger.info('播放器初始化完成')
}

const PlayerLogic = {
	// 初始化播放器
	async preparePlayer(): Promise<void> {
		try {
			const setup = async () => {
				try {
					await TrackPlayer.setupPlayer({
						minBuffer: 15,
						maxBuffer: 300,
						backBuffer: 40,
						autoHandleInterruptions: true,
					})
				} catch (e) {
					return (e as Error & { code?: string }).code
				}
			}
			// 避免在后台初始化播放器失败（虽然这是小概率事件）
			while ((await setup()) === 'android_cannot_setup_player_in_background') {
				await new Promise<void>((resolve) => setTimeout(resolve, 1))
			}

			// 设置播放器能力（怕自己忘了记一下：如果想修改这些能力对应的函数调用，要去 /lib/services/playbackService 里改）
			await TrackPlayer.updateOptions({
				capabilities: [
					Capability.Play,
					Capability.Pause,
					Capability.Stop,
					Capability.SkipToNext,
					Capability.SkipToPrevious,
					Capability.SeekTo,
				],
				progressUpdateEventInterval: 0.2,
				android: {
					appKilledPlaybackBehavior:
						AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
				},
			})
			// 设置重复模式为 Off
			await TrackPlayer.setRepeatMode(RepeatMode.Off)
		} catch (error: unknown) {
			logger.error('初始化播放器失败', error)
			reportErrorToSentry(error, '初始化播放器失败', ProjectScope.Player)
		}
	},
}

export { initPlayer, PlayerLogic }
