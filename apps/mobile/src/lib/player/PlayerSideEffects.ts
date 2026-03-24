import { Orpheus } from '@bbplayer/orpheus'

import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import log from '@/utils/log'

const logger = log.extend('Manager.PlayerSideEffects')

class PlayerSideEffects {
	private initialized = false

	public initialize() {
		if (this.initialized) return
		this.initialized = true

		logger.info('Initializing PlayerSideEffects')

		// 当曲目开始播放时，预加载下一首歌词
		Orpheus.addListener('onTrackStarted', () => {
			logger.debug('Track started, triggering side effects')
			void lyricService.preloadNextTrackLyrics()
		})

		// 桌面歌词面板「清空歌词」按钮被点击时，标记该曲目跳过歌词
		Orpheus.addListener('onRequestClearLyrics', ({ trackId }) => {
			logger.info('收到清空歌词请求', { trackId })
			void lyricService.skipLyric(trackId).then(() => {
				// 使 React Query 缓存失效，让歌词面板立即显示跳过提示
				void queryClient.invalidateQueries({
					queryKey: lyricsQueryKeys.smartFetchLyrics(trackId),
				})
			})
		})
	}
}

export const playerSideEffects = new PlayerSideEffects()
