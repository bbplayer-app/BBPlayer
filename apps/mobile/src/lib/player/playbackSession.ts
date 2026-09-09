import { Orpheus, type PlayerMode, type Track } from '@bbplayer/orpheus'

import useAppStore from '@/hooks/stores/useAppStore'
import { usePlaybackContextStore } from '@/hooks/stores/usePlaybackContextStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import usePlayerStore from '@/hooks/stores/usePlayerStore'
import { playlistService } from '@/lib/services/playlistService'

let pending: Promise<unknown> = Promise.resolve()

export function runPlaybackCommand<T>(operation: () => Promise<T>): Promise<T> {
	const result = pending.then(operation)
	pending = result.catch(() => undefined)
	return result
}

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
	const initialMode = await resolveInitialMode(options.playlistId)
	if (options.playNext) {
		await Orpheus.playNext(options.tracks[0], initialMode)
	} else {
		await Orpheus.addToEnd(
			options.tracks,
			options.startFromKey,
			replace,
			initialMode,
		)
	}
	if (options.playNow && (options.playNext || !options.startFromKey))
		await Orpheus.play()
}

/** Replace the queue and begin a new continuous playback experience. */
export function startPlayback(options: QueueOptions) {
	return runPlaybackCommand(() => submitTracks(options, true))
}

/** An initial mode is only applied by native code when the queue is empty. */
export function enqueueTracks(options: QueueOptions) {
	return runPlaybackCommand(() => submitTracks(options, false))
}

export function switchPlayerMode(mode: PlayerMode) {
	return runPlaybackCommand(async () => {
		await Orpheus.setPlayerMode(mode)
		await usePlaybackContextStore.getState().sync()
	})
}

export function clearPlaybackQueue() {
	return runPlaybackCommand(async () => {
		await Orpheus.clearQueue()
		await Promise.all([
			usePlaybackContextStore.getState().sync(),
			usePlayerQueueStore.getState().sync(),
			usePlayerStore.getState().sync(),
		])
	})
}
