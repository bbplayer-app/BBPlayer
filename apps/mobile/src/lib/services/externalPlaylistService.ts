import { decode } from 'he'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import {
	BilibiliApiError,
	isBilibiliRateLimitError,
} from '@/lib/errors/thirdparty/bilibili'
import {
	createImportJobId,
	externalImportJobService,
} from '@/lib/services/externalImportJobService'
import { playlistOutService } from '@/lib/services/playlistOutService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'
import log from '@/utils/log'
import { cleanString, gaussian, lcsScore } from '@/utils/matching'
import { parseDurationString } from '@/utils/time'

const logger = log.extend('Services.ExternalPlaylist')

// 全局配置（保持单并发与保守请求间隔，优先响应明确风控信号）
export const DEFAULT_REQUEST_DELAY_MS = 2800
const SEARCH_TIMEOUT = 15_000
const BLACKLIST_ZONES = new Set([26, 29, 31, 201, 238]) // 黑名单分区 (音MAD, 现场, 翻唱, 科普, 运动)
const PRIORITY_ZONES = new Set([193, 130, 267]) // 优先分区 (MV, 音乐综合, 电台)

const wait = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error('Aborted'))
			return
		}
		if (ms <= 0) {
			resolve()
			return
		}
		const onAbort = () => {
			clearTimeout(timer)
			reject(new Error('Aborted'))
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		signal?.addEventListener('abort', onAbort, { once: true })
	})

const createSearchSignal = (
	parentSignal?: AbortSignal,
	timeoutMs = SEARCH_TIMEOUT,
) => {
	const controller = new AbortController()
	let timedOut = false
	const timeoutId = setTimeout(() => {
		timedOut = true
		controller.abort()
	}, timeoutMs)
	const abortFromParent = () => controller.abort()

	if (parentSignal?.aborted) {
		controller.abort()
	} else {
		parentSignal?.addEventListener('abort', abortFromParent, { once: true })
	}

	return {
		signal: controller.signal,
		didTimeout: () => timedOut,
		cleanup: () => {
			clearTimeout(timeoutId)
			parentSignal?.removeEventListener('abort', abortFromParent)
		},
	}
}

interface MatchCandidate {
	video: BilibiliSearchVideo
	score: number
}

export type MatchResultStatus =
	| 'pending'
	| 'matched'
	| 'unmatched'
	| 'error'
	| 'rate_limited'

export type MatchErrorType =
	| 'network'
	| 'timeout'
	| 'api'
	| 'rate_limited'
	| 'unknown'

export interface MatchResult {
	track: GenericTrack
	matchedVideo: BilibiliSearchVideo | null
	status?: MatchResultStatus
	trackFingerprint?: string
	errorType?: MatchErrorType
	errorMessage?: string
}

export function getTrackFingerprint(track: GenericTrack): string {
	const title = track.title.trim().toLowerCase()
	const translatedTitle = (track.translatedTitle ?? '').trim().toLowerCase()
	const artists = track.artists
		.map((a) => a.trim().toLowerCase())
		.filter(Boolean)
		.join('/')
	const album = (track.album ?? '').trim().toLowerCase()
	const durationSec = Math.round((track.duration ?? 0) / 1000)
	return `${title}::${translatedTitle}::${artists}::${album}::${durationSec}`
}

export function getMatchResultFingerprint(result: MatchResult): string {
	return result.trackFingerprint ?? getTrackFingerprint(result.track)
}

export function isMatchResultForTrack(
	result: MatchResult | undefined,
	track: GenericTrack | undefined,
): result is MatchResult {
	if (!result || !track) return false
	return getMatchResultFingerprint(result) === getTrackFingerprint(track)
}

export function getMatchResultStatus(
	result?: MatchResult | null,
): MatchResultStatus {
	if (!result) return 'pending'
	if (result.status) return result.status
	return result.matchedVideo ? 'matched' : 'unmatched'
}

export type ExternalPlaylistSource =
	| 'netease'
	| 'qq'
	| 'playlistout'
	| 'local_json'

export class ExternalPlaylistService {
	public fetchExternalPlaylist(
		playlistId: string,
		source: ExternalPlaylistSource,
	): ResultAsync<{ playlist: GenericPlaylist; tracks: GenericTrack[] }, Error> {
		const fallbackToPersistedDraft = (err: Error) => {
			try {
				const jobId = createImportJobId(source, playlistId)
				const snap = externalImportJobService.getJobSnapshot(jobId)
				if (snap && snap.items.length > 0) {
					return okAsync({
						playlist: snap.job.playlistMetadata,
						tracks: snap.items.map((item) => item.originalTrack),
					})
				}
			} catch {
				// Fall through to original error
			}
			return errAsync(err)
		}

		if (source === 'playlistout') {
			return playlistOutService
				.resolvePlaylist(playlistId)
				.orElse(fallbackToPersistedDraft)
		} else if (source === 'local_json') {
			return playlistOutService
				.getCachedPlaylist(playlistId)
				.orElse(fallbackToPersistedDraft)
		} else if (source === 'netease') {
			return neteaseApi.getPlaylist(playlistId).map((response) => {
				if (!response.playlist) {
					return {
						playlist: {
							id: playlistId,
							title: 'Unknown Playlist',
							coverUrl: '',
							description: '',
							trackCount: 0,
							author: {
								name: 'Unknown',
								id: 0,
							},
						},
						tracks: [],
					}
				}

				const tracks = (response.playlist.tracks ?? []).map((track) => ({
					title: track.name,
					artists: track.ar.map((a) => a.name),
					album: track.al.name,
					duration: track.dt,
					coverUrl: track.al.picUrl.replace('http://', 'https://'),
					translatedTitle: track.tns?.[0],
				}))

				const createDate =
					response.playlist.createTime > 0
						? new Date(
								response.playlist.createTime > 1e11
									? response.playlist.createTime
									: response.playlist.createTime * 1000,
							)
						: null
				const createTime =
					createDate && !isNaN(createDate.getTime())
						? `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`
						: undefined

				return {
					playlist: {
						id: response.playlist.id.toString(),
						title: decode(response.playlist.name),
						coverUrl: response.playlist.coverImgUrl,
						description: decode(
							(response.playlist.description ?? '').replace(
								/<br\s*\/?>/gi,
								'\n',
							),
						).trim(),
						trackCount: response.playlist.trackCount,
						author: {
							name: response.playlist.creator?.nickname ?? 'Unknown',
							id: response.playlist.creator?.userId ?? 0,
						},
						createTime,
						tags:
							Array.isArray(response.playlist.tags) &&
							response.playlist.tags.length > 0
								? response.playlist.tags
								: undefined,
						platform: 'netease',
					},
					tracks,
				}
			})
		} else if (source === 'qq') {
			return qqMusicApi.getPlaylist(playlistId).map((response) => {
				const playlist = response.data?.cdlist?.[0]
				if (!playlist)
					return {
						playlist: {
							id: playlistId,
							title: 'Unknown',
							coverUrl: '',
							description: '',
							trackCount: 0,
							author: { name: 'Unknown' },
						},
						tracks: [],
					}

				const tracks = playlist.songlist.map((track) => ({
					title: decode(track.name),
					artists: track.singer.map((s) => decode(s.name)),
					album: decode(track.album.name),
					duration: track.interval * 1000,
					coverUrl: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.mid}.jpg`,
					translatedTitle: track.subtitle ? decode(track.subtitle) : undefined,
				}))

				const createDate =
					typeof playlist.ctime === 'number' && playlist.ctime > 0
						? new Date(
								playlist.ctime > 1e11 ? playlist.ctime : playlist.ctime * 1000,
							)
						: null
				const createTime =
					createDate && !isNaN(createDate.getTime())
						? `${createDate.getFullYear()}-${String(createDate.getMonth() + 1).padStart(2, '0')}-${String(createDate.getDate()).padStart(2, '0')}`
						: undefined

				const tags = Array.isArray(playlist.tags)
					? playlist.tags
							.map((t) => (t?.name ? decode(t.name).trim() : ''))
							.filter(Boolean)
					: []

				return {
					playlist: {
						id: playlistId,
						title: decode(playlist.dissname).trim(),
						coverUrl: playlist.logo,
						description: decode(
							(playlist.desc || '').replace(/<br\s*\/?>/gi, '\n'),
						).trim(),
						trackCount: playlist.songnum,
						author: {
							name: decode(playlist.nickname).trim(),
						},
						createTime,
						tags: tags.length > 0 ? tags : undefined,
						platform: 'qqmusic',
					},
					tracks,
				}
			})
		}
		return errAsync(new Error('Unsupported source: ' + String(source)))
	}

	public matchExternalPlaylist(
		tracks: GenericTrack[],
		onProgress: (
			current: number,
			total: number,
			result: MatchResult,
			trackIndex: number,
		) => void,
		options?: {
			signal?: AbortSignal
			startIndex?: number
			trackIndexes?: number[]
			requestDelayMs?: number
			searchTimeoutMs?: number
		},
	): ResultAsync<MatchResult[], Error> {
		return ResultAsync.fromPromise(
			(async () => {
				const results: MatchResult[] = []
				const total = tracks.length
				const startIndex = options?.startIndex ?? 0
				const indexesToProcess =
					options?.trackIndexes ??
					Array.from(
						{ length: Math.max(total - startIndex, 0) },
						(_, index) => startIndex + index,
					)
				const processingTotal = indexesToProcess.length
				const delayMs = options?.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS
				const searchTimeoutMs = options?.searchTimeoutMs ?? SEARCH_TIMEOUT

				for (const [processedCount, trackIndex] of indexesToProcess.entries()) {
					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const song = tracks[trackIndex]
					if (!song) {
						continue
					}
					if (processedCount > 0) {
						// oxlint-disable-next-line no-await-in-loop
						await wait(delayMs, options?.signal)
					}

					// Double check after wait
					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const titlePart = [song.title, song.translatedTitle]
						.map((t) => t?.trim())
						.filter(Boolean)
						.join(' ')
					const artistPart = song.artists
						.map((a) => a.trim())
						.filter(Boolean)
						.join(' ')
					const searchQuery = artistPart
						? `${titlePart} - ${artistPart}`
						: titlePart
					const trackFingerprint = getTrackFingerprint(song)

					let matchedVideo: BilibiliSearchVideo | null = null
					let status: MatchResultStatus = 'unmatched'
					let errorType: MatchErrorType | undefined
					let errorMessage: string | undefined

					const { signal, didTimeout, cleanup } = createSearchSignal(
						options?.signal,
						searchTimeoutMs,
					)

					try {
						// oxlint-disable-next-line no-await-in-loop
						const searchResult = await (async () => {
							try {
								return await bilibiliApi.searchVideos({
									keyword: searchQuery,
									page: 1,

									signal,
								})
							} finally {
								cleanup()
							}
						})()

						if (options?.signal?.aborted) {
							throw new Error('Aborted')
						}

						if (searchResult.isOk()) {
							const decodedResults = searchResult.value.result.map((video) => ({
								...video,
								title: decode(video.title),
							}))
							matchedVideo = this.findBestMatchSimple(decodedResults, song)
							status = matchedVideo ? 'matched' : 'unmatched'
						} else {
							const err = searchResult.error
							if (isBilibiliRateLimitError(err)) {
								logger.warning(`Rate limit triggered on ${song.title}:`, err)
								const rateLimitedResult: MatchResult = {
									track: song,
									matchedVideo: null,
									status: 'rate_limited',
									trackFingerprint,
									errorType: 'rate_limited',
									errorMessage:
										err.message && err.message !== 'OK'
											? err.message
											: '请求暂时受限，进度已保存',
								}
								onProgress(
									processedCount,
									processingTotal,
									rateLimitedResult,
									trackIndex,
								)
								throw new BilibiliApiError({
									message:
										err.message && err.message !== 'OK'
											? err.message
											: '请求暂时受限，进度已保存',
									msgCode: err.data?.msgCode || 412,
									rawData: err.data?.rawData,
									type: 'RateLimited',
									cause: err,
								})
							}

							logger.error(`Search failed for ${song.title}:`, err)
							status = 'error'
							const isTimeout = didTimeout() || err.type === 'RequestAborted'
							errorType = isTimeout
								? 'timeout'
								: err.type === 'ResponseFailed'
									? 'api'
									: 'network'
							errorMessage = isTimeout
								? '搜索请求超时'
								: err.message || '网络或接口异常'
						}
					} catch (e) {
						if (options?.signal?.aborted) {
							throw new Error('Aborted', { cause: e })
						}
						if (isBilibiliRateLimitError(e)) {
							if (
								!(e instanceof BilibiliApiError && e.type === 'RateLimited')
							) {
								const rateLimitedResult: MatchResult = {
									track: song,
									matchedVideo: null,
									status: 'rate_limited',
									trackFingerprint,
									errorType: 'rate_limited',
									errorMessage:
										e instanceof Error && e.message !== 'OK'
											? e.message
											: '请求暂时受限，进度已保存',
								}
								onProgress(
									processedCount,
									processingTotal,
									rateLimitedResult,
									trackIndex,
								)
							}
							throw e instanceof Error
								? e
								: new BilibiliApiError({
										message: String(e),
										msgCode: 412,
										type: 'RateLimited',
										cause: e,
									})
						}
						logger.error(`Error processing ${song.title}:`, e)
						status = 'error'
						errorType = didTimeout() ? 'timeout' : 'network'
						errorMessage = didTimeout()
							? '搜索请求超时'
							: e instanceof Error
								? e.message
								: String(e)
					}

					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const result: MatchResult = {
						track: song,
						matchedVideo,
						status,
						trackFingerprint,
						...(errorType ? { errorType } : {}),
						...(errorMessage ? { errorMessage } : {}),
					}
					results.push(result)
					onProgress(processedCount + 1, processingTotal, result, trackIndex)
				}

				return results
			})(),
			(e) => (e instanceof Error ? e : new Error(String(e))),
		)
	}

	// 经过测试，反而这种简单的方式准确率更高。。。相信大数据.jpg
	private findBestMatchSimple(
		results: BilibiliSearchVideo[],
		targetSong: GenericTrack,
	): BilibiliSearchVideo | null {
		const targetDurationSec = targetSong.duration / 1000

		for (const video of results) {
			// 1. 黑名单过滤
			if (BLACKLIST_ZONES.has(video.typeid)) {
				continue
			}

			// 2. 时长过滤 (差异 > 20s 排除)
			const videoDurationSec = parseDurationString(video.duration)
			const durationDiff = Math.abs(videoDurationSec - targetDurationSec)

			if (durationDiff > 20) {
				continue
			}

			// 3. 直接返回第一个满足条件的
			return video
		}

		return null
	}

	private findBestMatch(
		results: BilibiliSearchVideo[],
		targetSong: GenericTrack,
	): BilibiliSearchVideo | null {
		const candidates: MatchCandidate[] = []

		for (const video of results) {
			const score = this.rankScore(video, targetSong)
			if (score < 0.4) continue // 阈值过滤

			candidates.push({ video, score })
		}

		if (candidates.length === 0) return null

		candidates.sort((a, b) => b.score - a.score)
		return candidates[0].video
	}

	private rankScore(
		video: BilibiliSearchVideo,
		targetSong: GenericTrack,
	): number {
		// 1. 黑名单过滤
		if (BLACKLIST_ZONES.has(video.typeid)) {
			return -1
		}

		// 2. 时长硬性过滤 (差异 > 180s 直接排除)
		const targetDurationSec = targetSong.duration / 1000
		const videoDurationSec = parseDurationString(video.duration)
		const durationDiff = Math.abs(videoDurationSec - targetDurationSec)

		if (durationDiff > 180) {
			return -1
		}

		// 3. 计算各维度得分
		// 时长得分: Gaussian (sigma = 30s)
		const durationScore = gaussian(durationDiff, 30)

		const cleanVideoTitle = cleanString(video.title)
		const cleanTargetTitle = cleanString(targetSong.title)
		const cleanTargetArtist = cleanString(targetSong.artists.join(''))

		// 标题得分
		const titleScore = lcsScore(cleanVideoTitle, cleanTargetTitle)

		// 4. 综合得分
		// 权重: 标题 0.5, 时长 0.5
		let totalScore = titleScore * 0.5 + durationScore * 0.5

		// 额外加分项
		// 如果是优先分区 (官方/音乐区)，给予 10% 加成
		if (PRIORITY_ZONES.has(video.typeid)) {
			totalScore *= 1.1
		}

		// 歌手匹配加分 (如果能在标题里找到歌手，增加置信度)
		if (
			cleanTargetArtist.length > 0 &&
			cleanVideoTitle.includes(cleanTargetArtist)
		) {
			totalScore += 0.1
		}

		return totalScore
	}
}

export const externalPlaylistService = new ExternalPlaylistService()
