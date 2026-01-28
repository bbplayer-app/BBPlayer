import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { Orpheus, type Track as OrpheusTrack } from '@roitium/expo-orpheus'
import { create } from 'zustand'

const logger = log.extend('Store.Player')

interface PlayerState {
	orpheusTrack: OrpheusTrack | null
	internalTrack: Track | null
	currentIndex: number

	initialize: () => void
	sync: () => Promise<void>
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	orpheusTrack: null,
	internalTrack: null,
	currentIndex: -1,

	initialize: () => {
		void get().sync()

		Orpheus.addListener('onTrackStarted', async () => {
			await get().sync()
		})
	},

	sync: async () => {
		try {
			const [currentTrack, currentIndex] = await Promise.all([
				Orpheus.getCurrentTrack(),
				Orpheus.getCurrentIndex(),
			])

			const currentInternalTrackId = get().internalTrack?.uniqueKey
			const newTrackId = currentTrack?.id

			set({ orpheusTrack: currentTrack, currentIndex })

			if (!currentTrack) {
				set({ internalTrack: null })
				return
			}

			if (newTrackId !== currentInternalTrackId) {
				const result = await trackService.getTrackByUniqueKey(currentTrack.id)
				if (result.isErr()) {
					set({ internalTrack: null })
					toastAndLogError('读取当前曲目信息失败', result.error, 'Store.Player')
					return
				}
				set({ internalTrack: result.value })
			}
		} catch (e) {
			logger.warning('Failed to sync player state', { error: e })
		}
	},
}))

export default usePlayerStore
