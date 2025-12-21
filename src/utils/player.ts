import { trackKeys } from '@/hooks/queries/db/track'
import useAppStore from '@/hooks/stores/useAppStore'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { queryClient } from '@/lib/config/queryClient'
import { AppRuntime } from '@/lib/effect/runtime'
import {
	PlayerAudioUrlNotFoundError,
	type PlayerError,
} from '@/lib/errors/player'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import type { TrackService } from '@/lib/services/trackService'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { Orpheus, type Track as OrpheusTrack } from '@roitium/expo-orpheus'
import { Effect, Array as EffectArray, Option } from 'effect'
import { toastAndLogError } from './error-handling'
import log, { flatErrorMessage } from './log'

const logger = log.extend('Utils.Player')

/**
 * 将内部 Track 类型转换为 Orpheus 的 Track 类型。
 * @param track - 内部 Track 对象。
 * @returns 一个 Result 对象，成功时包含 OrpheusTrack，失败时包含 Error。
 */
function convertToOrpheusTrack(
	track: Track,
): Effect.Effect<OrpheusTrack, BilibiliApiError | PlayerError> {
	const url = getInternalPlayUri(track)

	return Effect.fromNullable(url).pipe(
		Effect.mapError(
			() => new PlayerAudioUrlNotFoundError({ source: track.source }),
		),
		Effect.tapError(() =>
			Effect.sync(() => logger.warning('没有找到有效的音频流 URL', track)),
		),
		Effect.map((validUrl) => ({
			id: track.uniqueKey,
			url: validUrl,
			title: track.title,
			artist: track.artist?.name,
			artwork: track.coverUrl ?? undefined,
			duration: track.duration,
		})),
	)
}

/**
 * 上报播放记录
 * 由于这只是一个非常边缘的功能，我们不关心他是否出错，所以发生报错时只写个 log，返回 void
 */
function reportPlaybackHistory(
	uniqueKey: string,
	position: number,
): Effect.Effect<void, BilibiliApiError | PlayerError, TrackService> {
	return Effect.gen(function* () {
		const shouldReport = yield* Effect.sync(() => {
			const state = useAppStore.getState()
			return state.settings.sendPlayHistory && state.hasBilibiliCookie()
		})

		if (!shouldReport) return

		const track = yield* trackService.getTrackByUniqueKey(uniqueKey).pipe(
			Effect.catchAll((error) =>
				Effect.sync(() => {
					toastAndLogError('查询 track 失败：', error, 'Utils.Player')
					return null
				}),
			),
		)

		if (!track) return

		const { source } = track
		if (
			source !== 'bilibili' ||
			!track.bilibiliMetadata.cid ||
			!track.bilibiliMetadata.bvid
		) {
			return
		}

		yield* Effect.sync(() =>
			logger.debug('上报播放记录', {
				bvid: track.bilibiliMetadata.bvid,
				cid: track.bilibiliMetadata.cid,
				position,
			}),
		)

		yield* bilibiliApi
			.reportPlaybackHistory(
				track.bilibiliMetadata.bvid,
				track.bilibiliMetadata.cid,
				position,
			)
			.pipe(
				Effect.catchAll((error) =>
					Effect.sync(() => {
						logger.warning('上报播放记录到 bilibili 失败', {
							params: {
								bvid: track.bilibiliMetadata.bvid,
								cid: track.bilibiliMetadata.cid,
							},
							error,
						})
					}),
				),
			)
	})
}

/**
 *
 * @param playNow 是否立即播放
 * @param clearQueue 是否清空队列
 * @param startFromKey 从指定的 key 开始播放（并立即开始播放，无视 playNow）
 * @param playNext 是否插入到下一首播放
 * @returns
 */
async function addToQueue({
	tracks,
	playNow,
	clearQueue,
	startFromKey,
	playNext,
}: {
	tracks: Track[]
	playNow: boolean
	clearQueue: boolean
	startFromKey?: string
	playNext: boolean
}) {
	const program = Effect.gen(function* () {
		if (!tracks || tracks.length === 0) {
			return
		}

		if (playNext && tracks.length > 1) {
			return yield* Effect.sync(() => {
				toastAndLogError(
					'AddToQueueError',
					'只能将单曲插入到下一首播放，已取消本次操作。',
					'Utils.Player',
				)
			})
		}

		yield* Effect.sync(() =>
			logger.debug('添加曲目到播放队列', {
				trackCount: tracks.length,
				playNow,
				clearQueue,
				startFromKey,
				playNext,
			}),
		)

		const maybeOrpheusTracks = yield* Effect.forEach(tracks, (track) =>
			convertToOrpheusTrack(track).pipe(
				Effect.map((t) => Option.some(t)),
				Effect.catchAll((error) =>
					Effect.sync(() => {
						logger.error('转换为 OrpheusTrack 失败，跳过该曲目', {
							trackId: track.id,
							error,
						})
						return Option.none()
					}),
				),
			),
		)

		const validTracks = EffectArray.getSomes(maybeOrpheusTracks)

		if (validTracks.length === 0) {
			return
		}

		if (playNext) {
			const firstTrack = validTracks[0]

			yield* Effect.promise(() => Orpheus.playNext(firstTrack))

			if (playNow) {
				yield* Effect.promise(() => Orpheus.play())
			}
			return
		}

		yield* Effect.tryPromise(() =>
			Orpheus.addToEnd(validTracks, startFromKey, clearQueue),
		)

		if (playNow && !startFromKey) {
			yield* Effect.tryPromise(() => Orpheus.play())
		}
	}).pipe(
		Effect.catchAll((e) =>
			Effect.sync(() => {
				logger.error('添加到队列失败：', { error: e })
			}),
		),
	)

	await AppRuntime.runPromise(program)
}

function getInternalPlayUri(track: Track) {
	if (track.source === 'bilibili') {
		return track.bilibiliMetadata.isMultiPage
			? `orpheus://bilibili?bvid=${track.bilibiliMetadata.bvid}&cid=${track.bilibiliMetadata.cid}`
			: `orpheus://bilibili?bvid=${track.bilibiliMetadata.bvid}`
	}
	if (track.source === 'local' && track.localMetadata) {
		return track.localMetadata.localPath
	}
	return undefined
}

function finalizeAndRecordCurrentTrack(
	uniqueKey: string,
	realDuration: number,
	position: number,
) {
	const program = Effect.gen(function* () {
		const playedSeconds = Math.max(0, Math.floor(position))
		const duration = Math.max(1, Math.floor(realDuration))
		const effectivePlayed = Math.min(playedSeconds, duration)
		const threshold = Math.max(Math.floor(duration * 0.9), duration - 2)
		const completed = effectivePlayed >= threshold

		yield* Effect.sync(() => {
			logger.info('完成播放', { uniqueKey })
			logger.debug('完成播放标记', {
				playedSeconds,
				duration,
				effectivePlayed,
				threshold,
				completed,
				uniqueKey,
			})
		})

		const now = yield* Effect.sync(() => Date.now())

		const addRecordResult = yield* trackService
			.addPlayRecordFromUniqueKey(uniqueKey, {
				startTime: (now - playedSeconds * 1000) / 1000,
				durationPlayed: effectivePlayed,
				completed,
			})
			.pipe(
				Effect.andThen(() =>
					Effect.sync(() => {
						logger.debug('增加播放记录成功', { uniqueKey })
						return true
					}),
				),
				Effect.catchAll((error) =>
					Effect.sync(() => {
						logger.debug('增加播放记录失败', {
							uniqueKey,
							message: flatErrorMessage(error),
						})
						return false
					}),
				),
			)

		if (!addRecordResult) {
			return
		}

		yield* Effect.promise(() =>
			queryClient.invalidateQueries({
				queryKey: trackKeys.leaderBoard(),
			}),
		)

		yield* reportPlaybackHistory(uniqueKey, effectivePlayed).pipe(
			Effect.catchAll((error) =>
				Effect.sync(() => logger.error('上报播放历史失败', error)),
			),
		)
	}).pipe(
		Effect.catchAllCause((cause) =>
			Effect.sync(() => logger.debug('增加播放记录异常', cause)),
		),
	)

	void AppRuntime.runPromise(program)
}

export {
	addToQueue,
	convertToOrpheusTrack,
	finalizeAndRecordCurrentTrack,
	getInternalPlayUri,
	reportPlaybackHistory,
}
