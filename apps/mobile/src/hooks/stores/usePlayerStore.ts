import { Orpheus, type Track as OrpheusTrack } from '@bbplayer/orpheus'
import { create } from 'zustand'

import { externalImportJobService } from '@/lib/services/externalImportJobService'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'

const logger = log.extend('Store.Player')
let syncRevision = 0
let initialized = false
let cachedRawTrack: Track | null = null

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
		if (initialized) return
		initialized = true
		void get().sync()

		Orpheus.addListener('onTrackStarted', async () => {
			await get().sync()
		})
		Orpheus.addListener('onQueueChanged', async () => {
			await get().sync()
		})
		externalImportJobService.subscribeChanges(() => {
			if (cachedRawTrack) {
				set({
					internalTrack:
						externalImportJobService.resolveTrackForPlayback(cachedRawTrack),
				})
			}
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
			const currentInternalTrackId = cachedRawTrack?.uniqueKey
			const newTrackId = currentTrack?.id

			set({ orpheusTrack: currentTrack, currentIndex })

			if (!currentTrack) {
				cachedRawTrack = null
				set({ internalTrack: null })
				return
			}

			if (newTrackId !== currentInternalTrackId || !cachedRawTrack) {
				const result = await trackService.getTrackByUniqueKey(currentTrack.id)

				if (revision !== syncRevision || get().orpheusTrack?.id !== newTrackId)
					return

				if (result.isErr()) {
					cachedRawTrack = null
					set({ internalTrack: null })
					toastAndLogError('读取当前曲目信息失败', result.error, 'Store.Player')
					return
				}
				cachedRawTrack = result.value
			}

			set({
				internalTrack:
					externalImportJobService.resolveTrackForPlayback(cachedRawTrack),
			})
		} catch (e) {
			logger.warning('Failed to sync player state', { error: e })
		}
	},
}))

export default usePlayerStore
