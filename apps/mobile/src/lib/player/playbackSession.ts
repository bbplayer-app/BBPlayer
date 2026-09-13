import { Orpheus, type Track } from '@bbplayer/orpheus'

import {
	createPlaybackContext,
	playbackContextStore$,
	reconcilePlaybackContext,
	setPlaybackContext,
	assertPlaybackContextAvailable,
} from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import usePlayerStore from '@/hooks/stores/usePlayerStore'
import { playlistService } from '@/lib/services/playlistService'
import type { PlayerMode } from '@/types/core/playback'

async function resolveInitialMode(playlistId?: number): Promise<PlayerMode> {
	const fallback = useAppStore.getState().settings.defaultPlayerMode
	if (playlistId === undefined) return fallback
	const result = await playlistService.getPlaylistMetadata(playlistId)
	if (result.isErr()) throw result.error
	if (!result.value) throw new Error('播放列表不存在')
	const preference = result.value.playerPreference
	return preference === 'music' || preference === 'podcast'
		? preference
		: fallback
}

interface QueueOptions {
	tracks: Track[]
	playlistId?: number
	playNow?: boolean
	startFromKey?: string
	playNext?: boolean
}

async function submitTracks(options: QueueOptions, replace: boolean) {
	if (!options.tracks.length) throw new Error('没有可播放的内容')
	if (options.playNext && options.tracks.length !== 1)
		throw new Error('下一首播放只支持单个音频')
	if (
		options.startFromKey &&
		!options.tracks.some((track) => track.id === options.startFromKey)
	) {
		throw new Error('选中的音频当前无法播放')
	}
	assertPlaybackContextAvailable()
	const queue = await Orpheus.getQueue()
	const previous = playbackContextStore$.context.peek()
	const context =
		replace || !queue.length
			? createPlaybackContext(await resolveInitialMode(options.playlistId))
			: (previous ??
				createPlaybackContext(
					useAppStore.getState().settings.defaultPlayerMode,
				))
	if (options.playNext) {
		await Orpheus.playNext(options.tracks[0])
	} else {
		await Orpheus.addToEnd(options.tracks, options.startFromKey, replace)
	}
	setPlaybackContext(context)
	if (options.playNow && (options.playNext || !options.startFromKey))
		await Orpheus.play()
}

/** Replace the queue and begin a new continuous playback experience. */
export function startPlayback(options: QueueOptions) {
	return submitTracks(options, true)
}

/** Appending preserves the current session; an empty queue starts a new one. */
export function enqueueTracks(options: QueueOptions) {
	return submitTracks(options, false)
}

export async function switchPlayerMode(mode: PlayerMode) {
	await reconcilePlaybackContext()
	if (playbackContextStore$.context.peek())
		playbackContextStore$.context.mode.set(mode)
}

export async function clearPlaybackQueue() {
	assertPlaybackContextAvailable()
	await Orpheus.pause()
	await Orpheus.cancelSleepTimer()
	await Orpheus.clear()
	setPlaybackContext(null)
	await Promise.all([
		usePlayerQueueStore.getState().sync(),
		usePlayerStore.getState().sync(),
	])
}
