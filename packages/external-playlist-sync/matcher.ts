import type {
	BilibiliSearchVideo,
	MatchCandidate,
} from './src/types/bilibili.js'
import type { GenericTrack } from './src/types/common.js'

// 全局配置
const MIN_DELAY = 1200 // 防封号延迟 (ms)
const BLACKLIST_ZONES = [26, 29, 31, 201, 238] // 黑名单分区 (音MAD, 现场, 翻唱, 科普, 运动)
const PRIORITY_ZONES = [193, 130, 267] // 优先分区 (MV, 音乐综合, 电台)

// B站 API 接口定义 (placeholder)
interface BilibiliAPI {
	search(query: string, page: number): Promise<BilibiliSearchVideo[]>
}

// 模拟 B站 API
const bilibiliAPI: BilibiliAPI = {
	search: async (query: string, page: number) => {
		console.log(`[Mock] Searching for: ${query}, page: ${page}`)
		return []
	},
}

const saveMatch = (match: BilibiliSearchVideo) => {
	// TODO: Implement save logic
	console.log(`[Mock] Saved match: ${match.title} (${match.bvid})`)
}

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

// 主流程：处理歌单
export async function processPlaylist(tracks: GenericTrack[]) {
	for (const song of tracks) {
		// 1. 防封号机制：强制等待
		await wait(MIN_DELAY)

		// 2. 构造搜索关键词
		// 组合 "歌名 - 歌手" 以提高准确度
		const artistNames = song.artists.join(' ')
		const searchQuery = `${song.title} - ${artistNames}`

		// 3. 调用 B站 API 搜索
		// 注意：只取第 1 页结果
		const searchResults = await bilibiliAPI.search(searchQuery, 1)

		// 4. 筛选最佳匹配
		const bestMatch = findBestMatch(searchResults, song)

		if (bestMatch) {
			saveMatch(bestMatch)
		} else {
			console.log(`搜索失败: ${song.title}`)
		}
	}
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
		// targetSong.duration is in ms (NetEase)
		const targetDurationSec = targetSong.duration / 1000
		const videoDurationSec = parseDuration(video.duration)
		const durationDiff = Math.abs(videoDurationSec - targetDurationSec)

		// 2. 播放量加权 (对数加分，影响较小，主要用于同类微调)
		// Note: play count is not available in BilibiliSearchVideo, defaulting to 0
		const popularityBonus = 0

		// --- 步骤 D: 计算最终得分 ---
		const finalScore =
			baseScore + priorityBonus - durationDiff + popularityBonus

		// 保存候选项
		candidates.push({ video: video, score: finalScore })
	}

	// 返回分数最高的候选项
	if (candidates.length === 0) return null

	candidates.sort((a, b) => b.score - a.score)
	return candidates[0].video
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
	// 将标题、歌名、歌手切分为单词数组
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
	// search_query_words 是 "歌名 - 歌手" 的切词结果
	const searchQuery = `${targetSong.title} - ${artistNames}`
	const searchQueryWords = splitWords(searchQuery)

	if (intersection(videoWords, searchQueryWords).length > 0) {
		return 5
	}

	// Level 5: 无匹配
	return 0
}

// Helper: Split string into words (basic implementation)
function splitWords(text: string): string[] {
	// Remove special characters and split by whitespace
	return text
		.toLowerCase()
		.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // Keep alphanumeric and Chinese characters
		.split(/\s+/)
		.filter((w) => w.length > 0)
}

// Helper: Check if arr contains all elements of target
function containsAll(arr: string[], target: string[]): boolean {
	if (target.length === 0) return true
	const set = new Set(arr)
	return target.every((t) => set.has(t))
}

// Helper: Intersection of two arrays
function intersection(arr1: string[], arr2: string[]): string[] {
	const set1 = new Set(arr1)
	return arr2.filter((item) => set1.has(item))
}
