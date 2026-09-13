import { Orpheus } from '@bbplayer/orpheus'
import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { AppState } from 'react-native'

import useAppStore from '@/hooks/stores/useAppStore'
import {
	parsePlaybackContextState,
	type PlaybackContext,
	type PlaybackContextState,
	type PlayerMode,
} from '@/types/core/playback'
import log from '@/utils/log'
import { legendPersistStorage } from '@/utils/mmkv'

export const PLAYBACK_CONTEXT_STORAGE_KEY = 'playback-context-store'

export const playbackContextStore$ = observable<PlaybackContextState>({
	context: null,
	ready: false,
})

syncObservable(playbackContextStore$, {
	persist: {
		name: PLAYBACK_CONTEXT_STORAGE_KEY,
		plugin: legendPersistStorage,
		transform: {
			load: parsePlaybackContextState,
			save: (value) => ({ ...value, ready: false }),
		},
	},
})

let initialized = false
let restoringBackup = false

export function assertPlaybackContextAvailable() {
	if (restoringBackup) throw new Error('备份已恢复，请重启应用后继续播放')
}

export function createPlaybackContext(mode: PlayerMode): PlaybackContext {
	// This is a local correlation ID, not an authentication token.
	const sessionId =
		globalThis.crypto?.randomUUID?.() ??
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
	return { sessionId, mode }
}

export function setPlaybackContext(context: PlaybackContext | null) {
	assertPlaybackContextAvailable()
	playbackContextStore$.set({ context, ready: true })
}

/** An unready native service rejects getQueue rather than reporting an empty queue. */
export async function reconcilePlaybackContext() {
	assertPlaybackContextAvailable()
	const tracks = await Orpheus.getQueue()
	assertPlaybackContextAvailable()
	if (!tracks.length) setPlaybackContext(null)
	else if (!playbackContextStore$.context.peek()) {
		setPlaybackContext(
			createPlaybackContext(useAppStore.getState().settings.defaultPlayerMode),
		)
	} else playbackContextStore$.ready.set(true)
}

export function syncPlaybackContext() {
	return reconcilePlaybackContext()
}

export function initPlaybackContextStore() {
	if (initialized) return
	initialized = true
	const sync = () => {
		if (restoringBackup) return
		void syncPlaybackContext().catch((error: unknown) => {
			log.warning('同步当前播放上下文失败', { error })
		})
	}
	Orpheus.addListener('onQueueChanged', sync)
	AppState.addEventListener('change', (state) => {
		if (state === 'active') sync()
	})
	sync()
}

/** Backup restore already requires an app reload; do not let the old queue overwrite it. */
export function restorePlaybackContextState(encoded?: string) {
	const restored = encoded
		? parsePlaybackContextState(JSON.parse(encoded))
		: parsePlaybackContextState(null)
	restoringBackup = true
	playbackContextStore$.set(restored)
}
