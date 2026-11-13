import { Orpheus, type Track } from '@bbplayer/orpheus'
import type { Span } from '@sentry/react-native'

import {
	applyResumeStrategy,
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
import { markSpanError, markSpanTimeout, startOperation } from '@/lib/tracing'
import type { PlayerMode } from '@/types/core/playback'

/**
 * 进行中的 playback.start transaction。
 *
 * 生命周期：
 * - `submitTracks` 在能确定哪首歌会开始播放时创建（见 `resolveStartingTrackId`）
 * - `PlayerSideEffects` 在对应的 `onTrackStarted` 事件时结束；`onPlayerError` 时标记失败并结束
 * - `submitTracks` 自身抛错时标记失败并结束
 *
 * 只保留最后一次：用户快速切歌时，前一个 span 被新的替换并立即结束（标记 cancelled）。
 */
let pendingPlaybackSpan: Span | null = null
let pendingPlaybackTimeout: ReturnType<typeof setTimeout> | null = null

/** 超过这个时间仍未收到 onTrackStarted，视为起播超时（缓冲卡住、用户暂停、切到后台等） */
const PLAYBACK_START_TIMEOUT_MS = 30_000

/**
 * 取走并返回当前 pending 的 playback span，清空持有。
 * 供 PlayerSideEffects 在首次 onTrackStarted 时调用。
 */
export function takePendingPlaybackSpan(): Span | null {
	const span = pendingPlaybackSpan

	pendingPlaybackSpan = null

	if (pendingPlaybackTimeout) {
		clearTimeout(pendingPlaybackTimeout)
		pendingPlaybackTimeout = null
	}

	return span
}

function setPendingPlaybackSpan(span: Span) {
	takePendingPlaybackSpan()
	pendingPlaybackSpan = span
	pendingPlaybackTimeout = setTimeout(() => {
		const timedOut = takePendingPlaybackSpan()

		if (!timedOut) return
		markSpanTimeout(timedOut)
		timedOut.setAttribute('playback.timed_out', true)
		timedOut.end()
	}, PLAYBACK_START_TIMEOUT_MS)
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

/** 结束当前 pending 的 playback span 并标记为失败 */
export function failPendingPlaybackSpan(error: Error) {
	const span = takePendingPlaybackSpan()

	if (!span) return
	markSpanError(span, error)
	span.end()
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

	const willPlay =
		options.playNow && (options.playNext || !options.startFromKey)

	const startingTrackId = resolveStartingTrackId(
		options,
		replace,
		!queue.length,
	)

	if (startingTrackId) {
		// 取消上一个还未到达 onTrackStarted 的 span（用户快速切歌）
		const previousSpan = takePendingPlaybackSpan()

		if (previousSpan) {
			previousSpan.setAttribute('playback.cancelled', true)
			previousSpan.end()
		}

		const span = startOperation({
			name: 'playback.start',
			op: 'playback',
			attributes: {
				'playback.track_count': options.tracks.length,
				'playback.mode': context.mode,
				'playback.replace': replace,
				'playback.play_next': options.playNext ?? false,
				// 记录期望的第一个 track ID，用于在 onTrackStarted 中校验事件归属
				'playback.expected_first_track_id': startingTrackId,
			},
		})

		setPendingPlaybackSpan(span)
	}

	try {
		if (options.playNext) {
			applyResumeStrategy(context.mode)
			await Orpheus.playNext(options.tracks[0])
		} else {
			applyResumeStrategy(context.mode)
			await Orpheus.addToEnd(options.tracks, options.startFromKey, replace)
		}

		setPlaybackContext(context)

		if (willPlay) {
			await Orpheus.play()
		}
	} catch (error) {
		if (startingTrackId) {
			failPendingPlaybackSpan(
				error instanceof Error ? error : new Error(String(error)),
			)
		}

		throw error
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
	await Promise.all([
		usePlayerQueueStore.getState().sync(),
		usePlayerStore.getState().sync(),
	])
}
