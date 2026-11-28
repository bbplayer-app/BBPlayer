import {
	Orpheus,
	PlaybackState,
	type Track as OrpheusTrack,
} from '@bbplayer/orpheus'
import { create } from 'zustand'

import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'

const logger = log.extend('Store.Player')
let syncRevision = 0
let initialized = false

interface PlayerState {
	orpheusTrack: OrpheusTrack | null
	internalTrack: Track | null
	currentIndex: number
	/**
	 * 最近一次收到的播放状态。原生层没有读取它的接口，只能从启动起一直订阅；
	 * usePlaybackState 在组件挂载后才开始收，会错过挂载前的状态，比如已经播完
	 */
	playbackState: PlaybackState

	initialize: () => void
	sync: () => Promise<void>
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	orpheusTrack: null,
	internalTrack: null,
	currentIndex: -1,
	playbackState: PlaybackState.IDLE,

	initialize: () => {
		if (initialized) return
		initialized = true
		void get().sync()

		Orpheus.addListener('onTrackStarted', async () => {
			await get().sync()
		})
		Orpheus.addListener('onQueueChanged', async () => {
			await get().sync()
		})
		Orpheus.addListener('onPlaybackStateChanged', ({ state }) => {
			set({ playbackState: state })
		})
	},

	sync: async () => {
		const revision = ++syncRevision

		try {
			const [currentTrack, currentIndex] = await Promise.all([
				Orpheus.getCurrentTrack(),
				Orpheus.getCurrentIndex(),
			])

			if (revision !== syncRevision) return
			const currentInternalTrackId = get().internalTrack?.uniqueKey
			const newTrackId = currentTrack?.id

			set({ orpheusTrack: currentTrack, currentIndex })

			if (!currentTrack) {
				set({ internalTrack: null })

				return
			}

			if (newTrackId !== currentInternalTrackId) {
				const result = await trackService.getTrackByUniqueKey(currentTrack.id)

				if (revision !== syncRevision || get().orpheusTrack?.id !== newTrackId)
					return

				if (result.isErr()) {
					set({ internalTrack: null })
					toastAndLogError('读取当前曲目信息失败', result.error, 'Store.Player')

					return
				}

				set({ internalTrack: result.value })
			}
		} catch (e) {
			logger.warning('player.state.sync_failed', {}, e)
		}
	},
}))

export default usePlayerStore
