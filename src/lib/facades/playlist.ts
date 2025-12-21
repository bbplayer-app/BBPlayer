import { DrizzleDB } from '@/lib/db/db'
import { TransactionFailedError } from '@/lib/errors'
import type { FacadeError } from '@/lib/errors/facade'
import {
	BatchAddTracksToLocalPlaylistFailedError,
	PlaylistDuplicateFailedError,
	UpdateTrackLocalPlaylistsFailedError,
} from '@/lib/errors/facade'
import { ValidationError } from '@/lib/errors/service'
import { ArtistService } from '@/lib/services/artistService'
import { PlaylistService } from '@/lib/services/playlistService'
import { TrackService } from '@/lib/services/trackService'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'
import log from '@/utils/log'
import { Context, Effect, Layer, Runtime } from 'effect'

const logger = log.extend('Facade')

export interface PlaylistFacadeSignature {
	readonly duplicatePlaylist: (
		playlistId: number,
		name: string,
	) => Effect.Effect<
		number,
		| FacadeError
		| ValidationError
		| TransactionFailedError
		| PlaylistDuplicateFailedError
	>

	readonly updateTrackLocalPlaylists: (params: {
		toAddPlaylistIds: number[]
		toRemovePlaylistIds: number[]
		trackPayload: CreateTrackPayload
		artistPayload?: CreateArtistPayload | null
	}) => Effect.Effect<
		number,
		| FacadeError
		| ValidationError
		| TransactionFailedError
		| UpdateTrackLocalPlaylistsFailedError
	>

	readonly batchAddTracksToLocalPlaylist: (
		playlistId: number,
		payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[],
	) => Effect.Effect<
		number[],
		| FacadeError
		| ValidationError
		| TransactionFailedError
		| BatchAddTracksToLocalPlaylistFailedError
	>
}

export class PlaylistFacade extends Context.Tag('PlaylistFacade')<
	PlaylistFacade,
	PlaylistFacadeSignature
>() {}

export const PlaylistFacadeLive = Layer.effect(
	PlaylistFacade,
	Effect.gen(function* () {
		const trackService = yield* TrackService
		const playlistService = yield* PlaylistService
		const artistService = yield* ArtistService
		const db = yield* DrizzleDB
		const runtime = yield* Effect.runtime()

		const runInTransaction = <A, E>(
			effect: Effect.Effect<A, E>,
		): Effect.Effect<A, E | TransactionFailedError> => {
			return Effect.tryPromise({
				try: () =>
					db.transaction(async (tx) => {
						const runnable = effect.pipe(
							Effect.provideService(DrizzleDB, tx as unknown as typeof db),
						)
						return Runtime.runPromise(runtime)(runnable)
					}),
				catch: (e) => {
					return new TransactionFailedError({
						message: 'Transaction failed',
						cause: e,
					})
				},
			}) as Effect.Effect<A, E | TransactionFailedError>
		}

		return {
			duplicatePlaylist: (playlistId, name) =>
				Effect.gen(function* () {
					logger.info('开始复制播放列表', { playlistId, name })

					const playlistMetadata = yield* playlistService
						.getPlaylistById(playlistId)
						.pipe(
							Effect.mapError(
								(e) =>
									new PlaylistDuplicateFailedError({
										cause: e,
										playlistName: name,
									}),
							),
						)

					if (!playlistMetadata) {
						return yield* new ValidationError({
							message: `未找到播放列表：${playlistId}`,
						})
					}

					logger.debug('step1: 获取播放列表', playlistMetadata.id)

					const localPlaylist = yield* playlistService
						.createPlaylist({
							title: name,
							description: playlistMetadata.description ?? undefined,
							coverUrl: playlistMetadata.coverUrl ?? undefined,
							authorId: null,
							type: 'local',
							remoteSyncId: null,
						})
						.pipe(
							Effect.mapError(
								(e) =>
									new PlaylistDuplicateFailedError({
										cause: e,
										playlistName: name,
									}),
							),
						)

					logger.debug('step2: 创建本地播放列表', localPlaylist)
					logger.info('创建本地播放列表成功', {
						localPlaylistId: localPlaylist.id,
					})

					const tracksMetadata = yield* playlistService
						.getPlaylistTracks(playlistId)
						.pipe(
							Effect.mapError(
								(e) =>
									new PlaylistDuplicateFailedError({
										cause: e,
										playlistName: name,
									}),
							),
						)

					const finalIds = tracksMetadata
						.filter((t) => {
							if (t.source === 'bilibili' && !t.bilibiliMetadata?.videoIsValid)
								return false
							return true
						})
						.map((t) => t.id)

					logger.debug(
						'step3: 获取播放列表中的所有歌曲并清洗完成（对于 bilibili 音频，去除掉失效视频）',
					)

					yield* playlistService
						.replacePlaylistAllTracks(localPlaylist.id, finalIds)
						.pipe(
							Effect.mapError(
								(e) =>
									new PlaylistDuplicateFailedError({
										cause: e,
										playlistName: name,
									}),
							),
						)

					logger.debug('step4: 替换本地播放列表中的所有歌曲')
					logger.info('复制播放列表成功', {
						sourcePlaylistId: playlistId,
						targetPlaylistId: localPlaylist.id,
						trackCount: finalIds.length,
					})

					return localPlaylist.id
				}).pipe(runInTransaction),

			updateTrackLocalPlaylists: (params) =>
				Effect.gen(function* () {
					const {
						toAddPlaylistIds,
						toRemovePlaylistIds,
						trackPayload,
						artistPayload,
					} = params

					logger.info('开始更新 Track 在本地播放列表', {
						toAdd: toAddPlaylistIds.length,
						toRemove: toRemovePlaylistIds.length,
						source: trackPayload.source,
						title: trackPayload.title,
					})

					// step1: 解析/创建 Artist（如需要）
					let finalArtistId: number | undefined =
						trackPayload.artistId ?? undefined
					if (finalArtistId === undefined && artistPayload) {
						const artist =
							yield* artistService.findOrCreateArtist(artistPayload)
						finalArtistId = artist.id
					}
					logger.debug('step1: 解析/创建 Artist 完成', finalArtistId ?? '(无)')

					// step2: 解析/创建 Track
					const track = yield* trackService.findOrCreateTrack({
						...trackPayload,
						artistId: finalArtistId ?? undefined,
					})
					const trackId = track.id
					logger.debug('step2: 解析/创建 Track 完成', trackId)

					// step3: 执行增删
					if (toAddPlaylistIds.length > 0) {
						for (const pid of toAddPlaylistIds) {
							yield* playlistService.addManyTracksToLocalPlaylist(pid, [
								trackId,
							])
						}
					}
					if (toRemovePlaylistIds.length > 0) {
						for (const pid of toRemovePlaylistIds) {
							yield* playlistService.batchRemoveTracksFromLocalPlaylist(pid, [
								trackId,
							])
						}
					}

					logger.debug('step3: 更新本地播放列表完成', {
						added: toAddPlaylistIds,
						removed: toRemovePlaylistIds,
					})

					logger.debug('更新 Track 在本地播放列表成功')
					logger.info('更新 Track 在本地播放列表成功', {
						trackId,
						added: toAddPlaylistIds.length,
						removed: toRemovePlaylistIds.length,
					})
					return trackId
				}).pipe(
					Effect.mapError(
						(e) =>
							new UpdateTrackLocalPlaylistsFailedError({
								cause: e,
							}),
					),
					runInTransaction,
				),

			batchAddTracksToLocalPlaylist: (playlistId, payloads) =>
				Effect.gen(function* () {
					logger.info('开始批量添加 tracks 到本地播放列表', {
						playlistId,
						count: payloads.length,
					})
					for (const payload of payloads) {
						if (payload.artist.source === 'local') {
							return yield* new ValidationError({
								message:
									'批量添加 tracks 到本地播放列表时，artist 只能为 remote 来源',
							})
						}
					}

					const artistMap = yield* artistService.findOrCreateManyRemoteArtists(
						payloads.map((p) => p.artist),
					)
					logger.debug('step1: 批量创建 artist 完成')

					const trackMap = yield* trackService.findOrCreateManyTracks(
						payloads.map((p) => ({
							...p.track,
							artistId: artistMap.get(p.artist.remoteId!)?.id,
						})),
						'bilibili',
					)
					const trackIds = Array.from(trackMap.values())
					logger.debug('step2: 批量创建 track 完成')

					yield* playlistService.addManyTracksToLocalPlaylist(
						playlistId,
						trackIds,
					)
					logger.debug('step3: 批量将 track 添加到本地播放列表完成')
					logger.info('批量添加 tracks 到本地播放列表成功', {
						playlistId,
						added: trackIds.length,
					})

					return trackIds
				}).pipe(
					Effect.mapError((e) =>
						e instanceof ValidationError
							? e
							: new BatchAddTracksToLocalPlaylistFailedError({
									cause: e,
									playlistId,
									trackCount: payloads.length,
								}),
					),
					runInTransaction,
				),
		}
	}),
)

export const playlistFacade = Effect.serviceFunctions(PlaylistFacade)
