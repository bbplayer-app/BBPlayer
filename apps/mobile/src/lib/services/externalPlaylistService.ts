import { decode } from 'he'
import { ResultAsync, errAsync } from 'neverthrow'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'
import log from '@/utils/log'
import { cleanString, gaussian, lcsScore } from '@/utils/matching'
import { parseDurationString } from '@/utils/time'

const logger = log.extend('Services.ExternalPlaylist')

// 全局配置
const MIN_DELAY = 1200 // 防封号延迟 (ms)
const BLACKLIST_ZONES = new Set([26, 29, 31, 201, 238]) // 黑名单分区 (音MAD, 现场, 翻唱, 科普, 运动)
const PRIORITY_ZONES = new Set([193, 130, 267]) // 优先分区 (MV, 音乐综合, 电台)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface MatchCandidate {
	video: BilibiliSearchVideo
	score: number
}

export interface MatchResult {
	track: GenericTrack
	matchedVideo: BilibiliSearchVideo | null
}

export class ExternalPlaylistService {
	public fetchExternalPlaylist(
		playlistId: string,
		source: 'netease' | 'qq',
	): ResultAsync<{ playlist: GenericPlaylist; tracks: GenericTrack[] }, Error> {
		if (source === 'netease') {
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

				return {
					playlist: {
						id: response.playlist.id.toString(),
						title: response.playlist.name,
						coverUrl: response.playlist.coverImgUrl,
						description: response.playlist.description ?? '',
						trackCount: response.playlist.trackCount,
						author: {
							name: response.playlist.creator?.nickname ?? 'Unknown',
							id: response.playlist.creator?.userId ?? 0,
						},
					},
					tracks,
				}
			})
		} else if (source === 'qq') {
			return qqMusicApi.getPlaylist(playlistId).map((response) => {
				const playlist = response.data.cdlist[0]
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
					title: track.name,
					artists: track.singer.map((s) => s.name),
					album: track.album.name,
					duration: track.interval * 1000,
					coverUrl: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.mid}.jpg`,
					translatedTitle: track.subtitle,
				}))

				return {
					playlist: {
						id: playlistId,
						title: playlist.dissname,
						coverUrl: playlist.logo,
						description: playlist.desc || '',
						trackCount: playlist.songnum,
						author: {
							name: playlist.nickname,
						},
					},
					tracks,
				}
			})
		}
		return errAsync(new Error('Unsupported source: ' + String(source)))
	}

	public matchExternalPlaylist(
		tracks: GenericTrack[],
		onProgress: (current: number, total: number, result: MatchResult) => void,
		options?: { signal?: AbortSignal; startIndex?: number },
	): ResultAsync<MatchResult[], Error> {
		return ResultAsync.fromPromise(
			(async () => {
				const results: MatchResult[] = []
				const total = tracks.length
				const startIndex = options?.startIndex ?? 0

				for (let i = startIndex; i < total; i++) {
					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const song = tracks[i]
					// oxlint-disable-next-line no-await-in-loop
					await wait(MIN_DELAY)

					// Double check after wait
					if (options?.signal?.aborted) {
						throw new Error('Aborted')
					}

					const artistNames = song.artists.join(' ')
					const searchQuery = `${song.title} ${song.translatedTitle ?? ''} - ${artistNames}`

					let matchedVideo: BilibiliSearchVideo | null = null

					try {
						// eslint-disable-next-line no-await-in-loop
						const searchResult = await bilibiliApi.searchVideos(
							searchQuery,
							1,
							{
								// 一点小巧思：带 cookie 调用搜索是会有个性化内容的，但在匹配时我认为个性化内容反而会干扰准确度
								skipCookie: true,
							},
						)

						if (searchResult.isOk()) {
							const decodedResults = searchResult.value.result.map((video) => ({
								...video,
								title: decode(video.title),
							}))
							matchedVideo = this.findBestMatchSimple(decodedResults, song)
						} else {
							logger.error(
								`Search failed for ${song.title}:`,
								searchResult.error,
							)
						}
					} catch (e) {
						logger.error(`Error processing ${song.title}:`, e)
					}

					const result: MatchResult = {
						track: song,
						matchedVideo: matchedVideo,
					}
					results.push(result)
					onProgress(i + 1, total, result)
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
