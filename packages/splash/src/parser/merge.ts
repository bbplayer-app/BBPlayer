import type { LyricLine } from '../types'

import { parseSpl } from './index'

export interface MultiLyricsInput {
	lrc: string
	tlyric?: string
	romalrc?: string
}

/**
 * 验证次要歌词与主歌词的时间轴匹配度
 */
function isMatch(mainLines: LyricLine[], secondaryLines: LyricLine[]): boolean {
	if (secondaryLines.length === 0) return false
	const mainTimestamps = new Set(mainLines.map((l) => l.startTime))
	let matchCount = 0
	for (const line of secondaryLines) {
		if (mainTimestamps.has(line.startTime)) matchCount++
	}
	return matchCount / secondaryLines.length >= 0.2
}

/**
 * 解析并合并主歌词、翻译、罗马音。
 * 核心逻辑：以主歌词为基准，通过时间戳对齐翻译和罗马音。
 */
export function parseAndMergeLyrics(input: MultiLyricsInput): LyricLine[] {
	if (!input.lrc) return []

	const mainLines = parseSpl(input.lrc).lines

	const getMappedLines = (raw?: string) => {
		if (!raw) return null
		try {
			const parsed = parseSpl(raw).lines
			if (!isMatch(mainLines, parsed)) return null
			return new Map(parsed.map((l) => [l.startTime, l.content]))
		} catch {
			return null
		}
	}

	const translationMap = getMappedLines(input.tlyric)
	const romajiMap = getMappedLines(input.romalrc)

	if (!translationMap && !romajiMap) return mainLines

	return mainLines.map((line) => ({
		...line,
		translation: translationMap?.get(line.startTime),
		romaji: romajiMap?.get(line.startTime),
		// 为旧版逻辑填充 translations 数组
		translations: [
			translationMap?.get(line.startTime),
			romajiMap?.get(line.startTime),
		].filter((v): v is string => !!v),
	}))
}
