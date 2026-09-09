import { Orpheus, type PlaybackContext } from '@bbplayer/orpheus'
import { AppState } from 'react-native'
import { create } from 'zustand'

import useAppStore from '@/hooks/stores/useAppStore'
import log from '@/utils/log'

let initialized = false
let revision = 0

export const usePlaybackContextStore = create<{
	context: PlaybackContext | null
	ready: boolean
	sync: () => Promise<void>
}>((set) => ({
	context: null,
	ready: false,
	sync: async () => {
		const request = ++revision
		const context = await Orpheus.getPlaybackContext(
			useAppStore.getState().settings.defaultPlayerMode,
		)
		if (request === revision) set({ context, ready: true })
	},
}))

export function initPlaybackContextStore() {
	if (initialized) return
	initialized = true
	const sync = () => {
		void usePlaybackContextStore
			.getState()
			.sync()
			.catch((error: unknown) => {
				log.warning('读取当前播放器模式失败', { error })
			})
	}
	Orpheus.addListener('onPlaybackContextChanged', ({ context }) => {
		++revision
		usePlaybackContextStore.setState({ context, ready: true })
	})
	Orpheus.addListener('onQueueChanged', sync)
	AppState.addEventListener('change', (state) => {
		if (state === 'active') sync()
	})
	sync()
}
