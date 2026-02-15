import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { ResultAsync } from 'neverthrow'

import db from '@/lib/db/db'
import type * as schema from '@/lib/db/schema'
import type { DatabaseError, ServiceError } from '@/lib/errors'
import type { FacadeError } from '@/lib/errors/facade'
import { createFacadeError } from '@/lib/errors/facade'
import { analyticsService } from '@/lib/services/analyticsService'
import type { ArtistService } from '@/lib/services/artistService'
import { artistService } from '@/lib/services/artistService'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import generateUniqueTrackKey from '@/lib/services/genKey'
import type { PlaylistService } from '@/lib/services/playlistService'
import { playlistService } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import { trackService } from '@/lib/services/trackService'
import log from '@/utils/log'
import { parseDurationString } from '@/utils/time'

const logger = log.extend('Facade/syncExternalPlaylist')

export class SyncExternalPlaylistFacade {
	constructor(
		private readonly trackService: TrackService,
		private readonly playlistService: PlaylistService,
		private readonly artistService: ArtistService,
		private readonly db: ExpoSQLiteDatabase<typeof schema>,
	) {}

	/**
	 * 保存匹配后的外部歌单到本地
	 * @param playlistInfo 歌单信息
	 * @param matchResults 匹配结果
	 */
	public saveMatchedPlaylist(
		playlistInfo: {
			title: string
			coverUrl: string
			description: string
		},
		matchResults: MatchResult[],
	): ResultAsync<number, FacadeError | DatabaseError | ServiceError> {
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)
				const artistSvc = this.artistService.withDB(tx)

				// 1. 提取所有需要创建/查找的 Artist
				const uniqueArtistsMap = new Map<
					string,
					{ name: string; remoteId: string; face?: string }
				>()

				const validMatches = matchResults.filter((r) => r.matchedVideo !== null)
				if (validMatches.length === 0) {
					throw createFacadeError(
						'SavePlaylistFailed',
						'没有匹配到任何歌曲，无法保存',
					)
				}

				for (const match of validMatches) {
					const video = match.matchedVideo!
					const remoteId = String(video.mid)
					if (!uniqueArtistsMap.has(remoteId)) {
						uniqueArtistsMap.set(remoteId, {
							name: video.author,
							remoteId: remoteId,
						})
					}
				}

				const artistPayloads = Array.from(uniqueArtistsMap.values()).map(
					(artist) => ({
						name: artist.name,
						source: 'bilibili' as const,
						remoteId: artist.remoteId,
						avatarUrl: undefined,
					}),
				)

				const artistsMapResult =
					await artistSvc.findOrCreateManyRemoteArtists(artistPayloads)
				if (artistsMapResult.isErr()) throw artistsMapResult.error
				const artistsMap = artistsMapResult.value

				// 2. 创建 Tracks
				const trackPayloads = validMatches.map((match) => {
					const video = match.matchedVideo!
					const artistId = artistsMap.get(String(video.mid))?.id

					return {
						title: video.title.replace(/<em[^>]*>|<\/em>/g, ''), // 去除高亮标签
						source: 'bilibili' as const,
						bilibiliMetadata: {
							bvid: video.bvid,
							isMultiPage: false,
							cid: undefined,
							videoIsValid: true,
						},
						coverUrl: video.pic.startsWith('//')
							? `https:${video.pic}`
							: video.pic,
						duration: parseDurationString(video.duration),
						artistId: artistId,
					}
				})

				const tracksResult = await trackSvc.findOrCreateManyTracks(
					trackPayloads,
					'bilibili',
				)
				if (tracksResult.isErr()) throw tracksResult.error
				const trackIdsMap = tracksResult.value

				// 3. 按照原始 matchResults 的顺序（保持用户看到的顺序）收集 ID
				const orderedTrackIds: number[] = []
				for (const payload of trackPayloads) {
					const keyResult = generateUniqueTrackKey(payload)
					if (keyResult.isOk()) {
						const id = trackIdsMap.get(keyResult.value)
						if (id) {
							orderedTrackIds.push(id)
						}
					}
				}

				// 4. 创建 Playlist
				const playlistResult = await playlistSvc.createPlaylist({
					title: playlistInfo.title,
					description: playlistInfo.description,
					coverUrl: playlistInfo.coverUrl,
					type: 'local', // 另存为本地歌单
					authorId: undefined, // 本地歌单没有 strict author
				})
				if (playlistResult.isErr()) throw playlistResult.error
				const playlistId = playlistResult.value.id

				// 5. 添加 Tracks 到 Playlist
				const addTracksResult = await playlistSvc.addManyTracksToLocalPlaylist(
					playlistId,
					orderedTrackIds,
				)
				if (addTracksResult.isErr()) throw addTracksResult.error

				logger.info('Save matched playlist success', { playlistId })
				void analyticsService.logPlaylistSync(
					'sync_external',
					'external',
					orderedTrackIds.length,
				)
				return playlistId
			}),
			(e) =>
				e instanceof Error
					? createFacadeError('SavePlaylistFailed', e.message, { cause: e })
					: createFacadeError('SavePlaylistFailed', String(e)),
		)
	}
}

export const syncExternalPlaylistFacade = new SyncExternalPlaylistFacade(
	trackService,
	playlistService,
	artistService,
	db,
)
