import type { LyricLine, RawLine, SplLyricData } from '../types'
import { SplParseError } from '../types'
import { parseTimeTag } from '../utils/time'

import { parseSpans } from './spans'

/**
 * 解析 SPL (Salt Player Lyrics) 格式歌词
 *
 * @param lrcContent SPL/LRC 格式的歌词字符串
 * @returns 解析后的歌词数据对象 {@link SplLyricData}
 * @throws {SplParseError} 当遇到无法解析的行时抛出错误
 */
export function parseSpl(lrcContent: string): SplLyricData {
	const lines = lrcContent.split(/\r?\n/)
	const meta: Record<string, string> = {}
	const rawLinesMap = new Map<number, RawLine[]>()

	let lastTimestamps: number[] | null = null

	for (let i = 0; i < lines.length; i++) {
		const originalLine = lines[i].trim()
		if (!originalLine) continue

		const metaMatch = /^\[([a-zA-Z]+):(.*)\]$/.exec(originalLine)
		if (metaMatch) {
			meta[metaMatch[1].trim()] = metaMatch[2].trim()
			continue
		}

		// 支持可选的负号时间戳解析
		const leadingTimeRegex = /^(\[(-?\d{1,3}):(-?\d{1,2})\.(\d{1,6})\])+/
		const match = leadingTimeRegex.exec(originalLine)

		if (!match) {
			if (lastTimestamps) {
				lastTimestamps.forEach((time) => {
					rawLinesMap.get(time)!.push({
						lineNumber: i + 1,
						timestamps: lastTimestamps!,
						content: originalLine,
					})
				})
				continue
			} else {
				// 若既无当前时间戳也关联不到上一行，则视作非法数据
				throw new SplParseError(
					i + 1,
					`未找到时间戳，且无法关联到上一行: "${originalLine}"`,
				)
			}
		}

		const fullTimePart = match[0]
		const content = originalLine.substring(fullTimePart.length)

		const singleTimeRegex = /\[(-?\d{1,3}):(-?\d{1,2})\.(\d{1,6})\]/g
		let tMatch

		const extractedTimes: number[] = []
		while ((tMatch = singleTimeRegex.exec(fullTimePart)) !== null) {
			extractedTimes.push(parseTimeTag(tMatch[0]))
		}

		extractedTimes.sort((a, b) => a - b)
		lastTimestamps = extractedTimes

		extractedTimes.forEach((time) => {
			if (!rawLinesMap.has(time)) {
				rawLinesMap.set(time, [])
			}
			rawLinesMap.get(time)!.push({
				lineNumber: i + 1,
				timestamps: extractedTimes,
				content: content,
			})
		})
	}

	const sortedTimes = Array.from(rawLinesMap.keys()).toSorted((a, b) => a - b)

	const finalLines: LyricLine[] = []

	for (let i = 0; i < sortedTimes.length; i++) {
		const startTime = sortedTimes[i]
		const candidates = rawLinesMap.get(startTime)!

		const mainRaw = candidates[0]
		const translationsRaw = candidates.slice(1)

		const translations = translationsRaw.map((c) => c.content)

		const {
			content: mainContent,
			spans,
			isDynamic,
			explicitEnd,
		} = parseSpans(mainRaw.content, startTime, mainRaw.lineNumber)

		let endTime = explicitEnd
		if (endTime === undefined) {
			// 若没显式结束标签，则取下一行起始时间或默认为 10s
			if (i < sortedTimes.length - 1) {
				endTime = sortedTimes[i + 1]
			} else {
				endTime = startTime + 10000
			}
		}

		const fixedSpans = spans.map((s) => {
			if (s.endTime === 0 || isNaN(s.endTime)) {
				const validEndTime = endTime
				return Object.assign(s, {
					endTime: validEndTime,
					duration: validEndTime - s.startTime,
				})
			}
			return s
		})

		finalLines.push({
			startTime,
			endTime: endTime,
			content: mainContent,
			translations,
			isDynamic,
			spans: fixedSpans,
		})
	}

	return {
		meta,
		lines: finalLines,
	}
}

/**
 * 验证 SPL/LRC 歌词格式是否正确
 *
 * @param lrcContent 待验证的歌词内容
 * @returns 验证结果对象
 */
export function verify(
	lrcContent: string,
): { isValid: true } | { isValid: false; error: SplParseError } {
	try {
		parseSpl(lrcContent)
		return { isValid: true }
	} catch (e) {
		if (e instanceof SplParseError) {
			return { isValid: false, error: e }
		}
		throw e
	}
}
