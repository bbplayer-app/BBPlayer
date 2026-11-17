import { Orpheus, type Track } from '@bbplayer/orpheus'

import { orpheusQueryKeys } from '@/hooks/queries/orpheus'
import {
	applyResumeStrategy,
	createPlaybackContext,
	playbackContextStore$,
	reconcilePlaybackContext,
	setPlaybackContext,
	assertPlaybackContextAvailable,
} from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import usePlayerStore from '@/hooks/stores/usePlayerStore'
import { queryClient } from '@/lib/config/queryClient'
import { playlistService } from '@/lib/services/playlistService'
import { traceOperation, traceSpan, type TraceParent } from '@/lib/tracing'
import type { PlayerMode } from '@/types/core/playback'

async function resolveInitialMode(
	playlistId: number | undefined,
	parent: TraceParent,
): Promise<PlayerMode> {
	const fallback = useAppStore.getState().settings.defaultPlayerMode

	if (playlistId === undefined) return fallback

	const result = await playlistService
		.withTrace(parent)
		.getPlaylistMetadata(playlistId)

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

/**
 * 推断这次提交后会开始播放的 track，无法确定（或不会触发播放）时返回 undefined。
 *
 * - 指定 `startFromKey`（非 playNext）：原生 addToEnd 会直接 seek 并播放该 track，无视 playNow
 * - playNow 且新队列的第一首就是 tracks[0]：替换队列，或原队列为空
 * - 其余情况（如向非空队列追加后 play）只是恢复当前曲目，不算一次新的起播
 */
function resolveStartingTrackId(
	options: QueueOptions,
	replace: boolean,
	queueEmpty: boolean,
): string | undefined {
	if (!options.playNext && options.startFromKey) return options.startFromKey

	if (!options.playNow) return undefined

	// playNext 只插入到当前曲目之后，不会清空队列
	if (queueEmpty || (replace && !options.playNext)) return options.tracks[0]?.id

	return undefined
}

/**
 * 提交到原生播放队列，记录一个 playback.submit span，只覆盖 JS 这一侧（校验、查歌单、调用原生）。
 * 等待出声的时间由原生的 playback.wait_for_audio 记录（不论起播由谁触发都会经过原生），两者是独立的 trace。
 */
async function submitTracks(options: QueueOptions, replace: boolean) {
	await traceOperation(
		{
			name: 'playback.submit',
			op: 'playback',
			attributes: {
				'playback.track_count': options.tracks.length,
				'playback.replace': replace,
				'playback.play_next': options.playNext ?? false,
			},
		},
		(span) => submitTracksImpl(options, replace, span),
	)
}

async function submitTracksImpl(
	options: QueueOptions,
	replace: boolean,
	span: TraceParent,
) {
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
	const queueEmpty = (await Orpheus.getQueueSize()) === 0
	const previous = playbackContextStore$.context.peek()

	const context =
		replace || queueEmpty
			? createPlaybackContext(
					await traceSpan(
						span,
						{ name: 'playback.resolve_mode', op: 'function' },
						(child) => resolveInitialMode(options.playlistId, child),
					),
				)
			: (previous ??
				createPlaybackContext(
					useAppStore.getState().settings.defaultPlayerMode,
				))

	const willPlay =
		options.playNow && (options.playNext || !options.startFromKey)

	const startingTrackId = resolveStartingTrackId(options, replace, queueEmpty)

	span?.setAttribute('playback.mode', context.mode)

	// 和原生 playback.wait_for_audio 的 track.id 对应，方便在 Sentry 里对照两边
	if (startingTrackId) {
		span?.setAttribute('playback.starting_track_id', startingTrackId)
	}

	applyResumeStrategy(context.mode)

	if (options.playNext) {
		await traceSpan(span, { name: 'Orpheus.playNext', op: 'function' }, () =>
			Orpheus.playNext(options.tracks[0]),
		)
	} else {
		await traceSpan(span, { name: 'Orpheus.addToEnd', op: 'function' }, () =>
			Orpheus.addToEnd(options.tracks, options.startFromKey, replace),
		)
	}

	setPlaybackContext(context)

	if (willPlay) {
		await traceSpan(span, { name: 'Orpheus.play', op: 'function' }, () =>
			Orpheus.play(),
		)
	}
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
	applyResumeStrategy(mode)

	if (playbackContextStore$.context.peek())
		playbackContextStore$.context.mode.set(mode)
}

export async function clearPlaybackQueue() {
	assertPlaybackContextAvailable()
	await Orpheus.pause()
	await Orpheus.cancelSleepTimer()
	await Orpheus.clear()
	setPlaybackContext(null)
	queryClient.setQueryData<Track[]>(orpheusQueryKeys.playerQueue(), [])
	await usePlayerStore.getState().sync()
}
