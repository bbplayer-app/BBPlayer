import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { ResultAsync } from 'neverthrow'

import defaultDb from '@/lib/db/db'
import type * as schema from '@/lib/db/schema'
import type { DatabaseError, ServiceError } from '@/lib/errors'
import type { FacadeError } from '@/lib/errors/facade'
import { createFacadeError } from '@/lib/errors/facade'
import { analyticsService } from '@/lib/services/analyticsService'
import type { ArtistService } from '@/lib/services/artistService'
import { artistService as artistServiceInstance } from '@/lib/services/artistService'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import generateUniqueTrackKey from '@/lib/services/genKey'
import type { PlaylistService } from '@/lib/services/playlistService'
import { playlistService as playlistServiceInstance } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import { trackService as trackServiceInstance } from '@/lib/services/trackService'
import type { GenericTrack } from '@/types/external_playlist'
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
	 * 直接导入已包含 B 站 BV 元数据的 JSON 歌单到本地（免搜索匹配）
	 * @param playlistInfo 歌单信息
	 * @param tracks 包含 bilibili 扩展元数据的歌曲列表
	 */
	public saveDirectBilibiliPlaylist(
		playlistInfo: {
			title: string
			coverUrl: string
			description: string
		},
		tracks: GenericTrack[],
	): ResultAsync<number, FacadeError | DatabaseError | ServiceError> {
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)
				const artistSvc = this.artistService.withDB(tx)

				const validTracks = tracks.filter((t) => Boolean(t.bilibili?.bvid))
				if (validTracks.length === 0) {
					throw createFacadeError(
						'SavePlaylistFailed',
						'未找到有效的哔哩哔哩视频信息，无法直接导入',
					)
				}

				// 1. 提取所有需要创建/查找的 B 站 UP 主 (Artist)
				const uniqueArtistsMap = new Map<
					string,
					{
						name: string
						remoteId: string
						avatarUrl?: string
						signature?: string
					}
				>()

				for (const track of validTracks) {
					const bili = track.bilibili!
					const artistName = track.artists[0]?.trim() || '未知UP主'
					const remoteId = bili.upMid?.trim() || `bili_up_${artistName}`
					if (!uniqueArtistsMap.has(remoteId)) {
						uniqueArtistsMap.set(remoteId, {
							name: artistName,
							remoteId,
							avatarUrl: bili.upAvatarUrl?.trim() || undefined,
							signature: bili.upSignature?.trim() || undefined,
						})
					}
				}

				const artistPayloads = Array.from(uniqueArtistsMap.values()).map(
					(artist) => ({
						name: artist.name,
						source: 'bilibili' as const,
						remoteId: artist.remoteId,
						avatarUrl: artist.avatarUrl,
						signature: artist.signature,
					}),
				)

				const artistsMapResult =
					await artistSvc.findOrCreateManyRemoteArtists(artistPayloads)
				if (artistsMapResult.isErr()) throw artistsMapResult.error
				const artistsMap = artistsMapResult.value

				// 2. 创建 Bilibili Tracks
				const trackPayloads = validTracks.map((track) => {
					const bili = track.bilibili!
					const artistName = track.artists[0]?.trim() || '未知UP主'
					const remoteId = bili.upMid?.trim() || `bili_up_${artistName}`
					const artistId = artistsMap.get(remoteId)?.id
					const hasCid =
						typeof bili.cid === 'number' &&
						Number.isFinite(bili.cid) &&
						bili.cid > 0
					const isMultiPage = Boolean(bili.isMultiPage && hasCid)
					const mainTrackTitle = isMultiPage
						? bili.mainTrackTitle?.trim() || track.album?.trim() || undefined
						: undefined

					return {
						title: track.title,
						source: 'bilibili' as const,
						bilibiliMetadata: {
							bvid: bili.bvid,
							isMultiPage,
							cid: hasCid ? bili.cid : undefined,
							mainTrackTitle,
							videoIsValid: track.isAvailable !== false,
						},
						coverUrl: track.coverUrl
							? track.coverUrl.startsWith('//')
								? `https:${track.coverUrl}`
								: track.coverUrl
							: undefined,
						duration: Math.max(0, Math.round((track.duration || 0) / 1000)),
						artistId,
					}
				})

				const tracksResult = await trackSvc.findOrCreateManyTracks(
					trackPayloads,
					'bilibili',
				)
				if (tracksResult.isErr()) throw tracksResult.error
				const trackIdsMap = tracksResult.value

				// 3. 按原始顺序收集去重后的 Track ID
				const orderedTrackIds: number[] = []
				const seenTrackIds = new Set<number>()
				for (const payload of trackPayloads) {
					const keyResult = generateUniqueTrackKey(payload)
					if (keyResult.isOk()) {
						const id = trackIdsMap.get(keyResult.value)
						if (id && !seenTrackIds.has(id)) {
							seenTrackIds.add(id)
							orderedTrackIds.push(id)
						}
					}
				}

				// 4. 创建本地 Playlist
				const playlistResult = await playlistSvc.createPlaylist({
					title: playlistInfo.title,
					description: playlistInfo.description,
					coverUrl: playlistInfo.coverUrl,
					type: 'local',
					authorId: undefined,
				})
				if (playlistResult.isErr()) throw playlistResult.error
				const playlistId = playlistResult.value.id

				// 5. 添加 Tracks 到 Playlist（逆序追加以保证 DESC sort_key 下第 1 首排在最前）
				const addTracksResult = await playlistSvc.addManyTracksToLocalPlaylist(
					playlistId,
					orderedTrackIds.toReversed(),
				)
				if (addTracksResult.isErr()) throw addTracksResult.error

				logger.info('Direct import bilibili JSON playlist success', {
					playlistId,
					trackCount: orderedTrackIds.length,
				})
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
	trackServiceInstance,
	playlistServiceInstance,
	artistServiceInstance,
	defaultDb,
)
