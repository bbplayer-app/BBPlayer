import { Orpheus, type Track as OrpheusTrack } from '@bbplayer/orpheus'
import { create } from 'zustand'

import log from '@/utils/log'

const logger = log.extend('Store.PlayerQueue')

interface PlayerQueueState {
	tracks: OrpheusTrack[]
	sync: () => Promise<void>
}

let initialized = false

export const usePlayerQueueStore = create<PlayerQueueState>((set) => ({
	tracks: [],

	sync: async () => {
		try {
			const tracks = await Orpheus.getQueue()
			set({ tracks })
		} catch (e) {
			logger.warning('Failed to sync player queue', { error: e })
		}
	},
}))

export function initPlayerQueueStore() {
	if (initialized) return
	initialized = true

	void usePlayerQueueStore.getState().sync()

	Orpheus.addListener('onQueueChanged', async () => {
		await usePlayerQueueStore.getState().sync()
	})
}
