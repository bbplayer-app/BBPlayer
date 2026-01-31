import { ResultAsync, okAsync } from 'neverthrow'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { GenericTrack } from '@/types/external_playlist'
import log from '@/utils/log'

const logger = log.extend('Services.ExternalPlaylist')

// 全局配置
const MIN_DELAY = 1200 // 防封号延迟 (ms)
const BLACKLIST_ZONES = [26, 29, 31, 201, 238] // 黑名单分区 (音MAD, 现场, 翻唱, 科普, 运动)
const PRIORITY_ZONES = [193, 130, 267] // 优先分区 (MV, 音乐综合, 电台)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper: Parse duration string (e.g., "03:45", "1:30:00") to seconds
function parseDuration(durationStr: string): number {
	const parts = durationStr.split(':').map(Number)
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2]
	} else if (parts.length === 2) {
		return parts[0] * 60 + parts[1]
	}
	return 0
}

interface MatchCandidate {
	video: BilibiliSearchVideo
	score: number
}

// 评分函数：判断标题匹配度与硬性过滤
function rankScore(
	video: BilibiliSearchVideo,
	targetSong: GenericTrack,
): number {
	// 1. 黑名单过滤 (直接排除)
	if (BLACKLIST_ZONES.includes(video.typeid)) {
		return -999
	}

	// 2. 时长硬性过滤
	// 如果时长差距超过 3 分钟，视为错误结果
	const targetDurationSec = targetSong.duration / 1000
	const videoDurationSec = parseDuration(video.duration)
	const durationDiff = Math.abs(videoDurationSec - targetDurationSec)
	if (durationDiff > 180) {
		return -999
	}

	// 3. 文本匹配逻辑
	// Helper: Split string into words (basic implementation)
	const splitWords = (text: string): string[] => {
		return text
			.toLowerCase()
			.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length > 0)
	}

	// Helper: Check if arr contains all elements of target
	const containsAll = (arr: string[], target: string[]): boolean => {
		if (target.length === 0) return true
		const set = new Set(arr)
		return target.every((t) => set.has(t))
	}

	// Helper: Intersection of two arrays
	const intersection = (arr1: string[], arr2: string[]): string[] => {
		const set1 = new Set(arr1)
		return arr2.filter((item) => set1.has(item))
	}

	const videoWords = splitWords(video.title)
	const targetTitleWords = splitWords(targetSong.title)
	const artistNames = targetSong.artists.join(' ')
	const targetArtistWords = splitWords(artistNames)

	const hasTitleMatch = containsAll(videoWords, targetTitleWords)
	const hasArtistMatch = containsAll(videoWords, targetArtistWords)

	// --- 匹配等级判定 ---

	// Level 1: 完美匹配 (歌名和歌手都全字匹配)
	if (hasTitleMatch && hasArtistMatch) {
		return 999
	}

	// Level 2: 时长强校验
	// 如果没有完美匹配，且时长误差 > 20秒，直接淘汰
	if (durationDiff > 20) {
		return -999
	}

	// Level 3: 强匹配 (包含歌名 或 包含歌手)
	if (hasTitleMatch || hasArtistMatch) {
		return 10
	}

	// Level 4: 弱匹配 (搜索词中有任意单词出现在标题中)
	const searchQuery = `${targetSong.title} - ${artistNames}`
	const searchQueryWords = splitWords(searchQuery)

	if (intersection(videoWords, searchQueryWords).length > 0) {
		return 5
	}

	// Level 5: 无匹配
	return 0
}

// 核心逻辑：寻找最佳匹配项
function findBestMatch(
	results: BilibiliSearchVideo[],
	targetSong: GenericTrack,
): BilibiliSearchVideo | null {
	const candidates: MatchCandidate[] = []

	for (const video of results) {
		// --- 步骤 A: 计算基础匹配分 (Base Score) ---
		const baseScore = rankScore(video, targetSong)

		// 如果基础分是负无穷，直接跳过
		if (baseScore <= -999) continue

		// --- 步骤 B: 计算分区权重 (Priority) ---
		let priorityBonus = 0
		if (PRIORITY_ZONES.includes(video.typeid)) {
			priorityBonus = 1000 // 官方/正式音源给予极大权重
		}

		// --- 步骤 C: 计算修正项 ---
		// 1. 时长误差惩罚 (越接近 0 扣分越少)
		const targetDurationSec = targetSong.duration / 1000
		const videoDurationSec = parseDuration(video.duration)
		const durationDiff = Math.abs(videoDurationSec - targetDurationSec)

		// 2. 播放量加权 (对数加分，影响较小，主要用于同类微调)
		// Play count is not available in BilibiliSearchVideo, defaulting to 0
		const popularityBonus = 0

		// --- 步骤 D: 计算最终得分 ---
		const finalScore =
			baseScore + priorityBonus - durationDiff + popularityBonus

		candidates.push({ video: video, score: finalScore })
	}

	// 返回分数最高的候选项
	if (candidates.length === 0) return null

	candidates.sort((a, b) => b.score - a.score)
	return candidates[0].video
}

export interface MatchResult {
	track: GenericTrack
	matchedVideo: BilibiliSearchVideo | null
}

export const externalPlaylistService = {
	fetchExternalPlaylist: (
		playlistId: string,
		source: 'netease' | 'qq',
	): ResultAsync<GenericTrack[], Error> => {
		if (source === 'netease') {
			return neteaseApi.getPlaylist(playlistId).map((response) => {
				return response.playlist.tracks.map((track) => ({
					title: track.name,
					artists: track.ar.map((a) => a.name),
					album: track.al.name,
					duration: track.dt,
				}))
			})
		} else if (source === 'qq') {
			return qqMusicApi.getPlaylist(playlistId).map((response) => {
				const playlist = response.data.cdlist[0]
				if (!playlist) return []
				return playlist.songlist.map((track) => ({
					title: track.name,
					artists: track.singer.map((s) => s.name),
					album: track.album.name,
					duration: track.interval * 1000,
				}))
			})
		}
		return okAsync([])
	},

	matchExternalPlaylist: (
		tracks: GenericTrack[],
		onProgress: (current: number, total: number, result: MatchResult) => void,
	): ResultAsync<MatchResult[], Error> => {
		return ResultAsync.fromPromise(
			(async () => {
				const results: MatchResult[] = []
				const total = tracks.length

				for (let i = 0; i < total; i++) {
					const song = tracks[i]
					await wait(MIN_DELAY)

					const artistNames = song.artists.join(' ')
					const searchQuery = `${song.title} - ${artistNames}`

					let matchedVideo: BilibiliSearchVideo | null = null

					try {
						const searchResult = await bilibiliApi.searchVideos(searchQuery, 1)

						if (searchResult.isOk()) {
							matchedVideo = findBestMatch(searchResult.value.result, song)
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
			(e) => new Error(String(e)),
		)
	},
}
