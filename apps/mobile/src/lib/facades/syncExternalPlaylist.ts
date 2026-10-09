import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { ResultAsync } from 'neverthrow'

import defaultDb from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import type { DatabaseError, ServiceError } from '@/lib/errors'
import type { FacadeError } from '@/lib/errors/facade'
import { createFacadeError } from '@/lib/errors/facade'
import { analyticsService } from '@/lib/services/analyticsService'
import type { ArtistService } from '@/lib/services/artistService'
import { artistService as artistServiceInstance } from '@/lib/services/artistService'
import {
	createImportItemId,
	createImportJobId,
	externalImportJobService,
	type UpsertExternalTrackMappingInput,
} from '@/lib/services/externalImportJobService'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import {
	type ExternalPlaylistSource,
	getMatchResultStatus,
	getTrackFingerprint,
} from '@/lib/services/externalPlaylistService'
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
		context?: {
			jobId?: string
			source?: ExternalPlaylistSource
			sourcePlaylistId?: string
		},
	): ResultAsync<number, FacadeError | DatabaseError | ServiceError> {
		return ResultAsync.fromPromise(
			(async () => {
				if (matchResults.length === 0) {
					throw createFacadeError(
						'SavePlaylistFailed',
						'歌单中没有可保存的歌曲',
					)
				}

				const externalSource: ExternalPlaylistSource =
					context?.source ?? 'netease'
				const externalPlaylistId =
					context?.sourcePlaylistId?.trim() || `saved_${Date.now()}`
				const resolvedJobId =
					context?.jobId ??
					createImportJobId(externalSource, externalPlaylistId)

				const mappingInputs: UpsertExternalTrackMappingInput[] = []

				const playlistId = await this.db.transaction(async (tx) => {
					const playlistSvc = this.playlistService.withDB(tx)
					const artistSvc = this.artistService.withDB(tx)

					// 1. 提取所有需要创建/查找的原始歌手
					const uniqueArtistsMap = new Map<
						string,
						{ name: string; remoteId: string }
					>()

					for (const match of matchResults) {
						const originalArtistName =
							match.track.artists.filter(Boolean).join(' / ').trim() ||
							match.matchedVideo?.author?.trim() ||
							'未知歌手'
						const remoteId = `ext_artist_${originalArtistName}`
						if (!uniqueArtistsMap.has(remoteId)) {
							uniqueArtistsMap.set(remoteId, {
								name: originalArtistName,
								remoteId,
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

					// 2. 创建本地 Playlist
					const playlistResult = await playlistSvc.createPlaylist({
						title: playlistInfo.title,
						description: playlistInfo.description,
						coverUrl: playlistInfo.coverUrl,
						type: 'local',
						authorId: undefined,
					})
					if (playlistResult.isErr()) throw playlistResult.error
					const createdPlaylistId = playlistResult.value.id

					// 3. 准备所有数据进行批量插入
					const orderedTrackIds: number[] = []
					const occurrenceCounter = new Map<string, number>()

					const trackInserts = []
					const metaDataInserts = []

					for (let i = 0; i < matchResults.length; i++) {
						const match = matchResults[i]
						const track = match.track
						const video = match.matchedVideo
						const fingerprint = getTrackFingerprint(track)
						const occurrence = occurrenceCounter.get(fingerprint) ?? 0
						occurrenceCounter.set(fingerprint, occurrence + 1)

						const originalArtistName =
							track.artists.filter(Boolean).join(' / ').trim() ||
							video?.author?.trim() ||
							'未知歌手'
						const artistRemoteId = `ext_artist_${originalArtistName}`
						const artistId = artistsMap.get(artistRemoteId)?.id

						const rawCover = track.coverUrl || video?.pic || undefined
						const normalizedCover = rawCover
							? rawCover.startsWith('//')
								? `https:${rawCover}`
								: rawCover
							: undefined

						const durationSec =
							track.duration > 0
								? Math.max(0, Math.round(track.duration / 1000))
								: video
									? parseDurationString(video.duration)
									: 0

						const uniqueKey = `external::${createdPlaylistId}::${fingerprint}#${occurrence}`

						trackInserts.push({
							title: track.title,
							source: 'bilibili' as const,
							artistId,
							coverUrl: normalizedCover,
							duration: durationSec,
							uniqueKey,
						})
					}

					let insertedTracks: { id: number }[] = []
					if (trackInserts.length > 0) {
						insertedTracks = await tx
							.insert(schema.tracks)
							.values(trackInserts)
							.returning({ id: schema.tracks.id })
					}

					for (let i = 0; i < matchResults.length; i++) {
						const trackId = insertedTracks[i]?.id
						if (!trackId) continue
						orderedTrackIds.push(trackId)
						const match = matchResults[i]
						const track = match.track
						const video = match.matchedVideo
						const status = getMatchResultStatus(match)
						const fingerprint = getTrackFingerprint(track)

						const uniqueKeyParts = trackInserts[i].uniqueKey.split('#')
						const occurrence = parseInt(
							uniqueKeyParts[uniqueKeyParts.length - 1],
							10,
						)

						const cleanVideoTitle = video
							? video.title.replace(/<em[^>]*>|<\/em>/g, '')
							: ''
						const mainTrackTitle = video
							? `音源: ${cleanVideoTitle}${video.author ? ` · UP: ${video.author}` : ''}`
							: status === 'rate_limited'
								? '[未匹配音源] Bilibili 请求受限，可继续匹配'
								: status === 'error'
									? `[未匹配音源] ${match.errorMessage ?? '网络或超时异常，可重试'}`
									: '[未匹配音源] 点击手动匹配或继续自动匹配'

						metaDataInserts.push({
							trackId,
							bvid: video?.bvid ?? '',
							cid: null,
							isMultiPage: false,
							mainTrackTitle,
							videoIsValid: true,
						})

						mappingInputs.push({
							trackId,
							playlistId: createdPlaylistId,
							jobId: resolvedJobId,
							itemId: createImportItemId(
								resolvedJobId,
								fingerprint,
								occurrence,
							),
							externalSource,
							externalPlaylistId,
							originalIndex: i,
							originalTrack: track,
							matchStatus: video
								? 'matched'
								: status === 'pending'
									? 'unmatched'
									: status,
							matchedVideo: video,
							errorType: match.errorType ?? null,
							errorMessage: match.errorMessage ?? null,
						})
					}

					if (metaDataInserts.length > 0) {
						await tx.insert(schema.bilibiliMetadata).values(metaDataInserts)
					}

					// 4. 添加 Tracks 到 Playlist（逆序追加以保证 DESC sort_key 下第 1 首排在最前）
					if (orderedTrackIds.length > 0) {
						const addTracksResult =
							await playlistSvc.addManyTracksToLocalPlaylist(
								createdPlaylistId,
								orderedTrackIds.toReversed(),
							)
						if (addTracksResult.isErr()) throw addTracksResult.error
					}

					return createdPlaylistId
				})

				// 5. 写入 external_track_mappings 并将对应的 Draft Import Job 标记为已确认
				externalImportJobService.upsertTrackMappings(mappingInputs)
				if (context?.jobId || context?.sourcePlaylistId) {
					externalImportJobService.markJobConfirmed(resolvedJobId, playlistId)
				}

				return playlistId
			})(),
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
