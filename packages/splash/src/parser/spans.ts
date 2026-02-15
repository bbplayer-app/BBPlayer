import type { LyricSpan } from '../types'
import { parseTimeTag } from '../utils/time'

/**
 * 解析单个歌词行中的逐字 Spans
 *
 * @param rawContent 原始歌词行内容 (去除行首时间戳后)，例如 "Hello<00:01.50>World"
 * @param lineStartTime 该行歌词的开始时间 (ms)
 * @param lineNumber 当前行号 (用于报错/警告)
 * @returns 解析结果，包含纯文本内容、Spans 数组、是否动态以及显式结束时间(如果有)
 */
export function parseSpans(
	rawContent: string,
	lineStartTime: number,
	lineNumber: number,
): {
	/** 纯文本内容 (移除标签后) */
	content: string
	/** 逐字片段列表 */
	spans: LyricSpan[]
	/** 是否包含逐字标签 */
	isDynamic: boolean
	/** 如果行末有显式时间标签，则返回该时间 (ms) */
	explicitEnd?: number
} {
	// 按标签切割，如 <mm:ss.SS> 或 [mm:ss.SS]
	const parts = rawContent.split(/([<[]\d{1,3}:\d{1,2}\.\d{1,6}[>\]])/)

	const spans: LyricSpan[] = []
	let currentTime = lineStartTime
	let explicitLineEnd: number | undefined
	let fullText = ''

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]
		if (i % 2 === 0) {
			if (part === '') continue
			spans.push({
				text: part,
				startTime: currentTime,
				endTime: 0, // 占位，待由下一个标签修正
				duration: 0,
			})
			fullText += part
		} else {
			const time = parseTimeTag(part)

			if (time < currentTime) {
				console.warn(
					`第 ${lineNumber} 行警告: 时间戳 ${part} (${time}) 小于当前时间 ${currentTime}，已忽略。`,
				)
				continue
			}

			if (spans.length > 0) {
				const lastSpan = spans[spans.length - 1]
				if (lastSpan.endTime === 0) {
					lastSpan.endTime = time
					lastSpan.duration = time - lastSpan.startTime
				}
			}

			currentTime = time
			explicitLineEnd = time
		}
	}

	const lastPart = parts[parts.length - 1]
	if (lastPart && lastPart.trim() !== '') {
		explicitLineEnd = undefined
	}

	return {
		content: fullText,
		spans,
		isDynamic: parts.length > 1,
		explicitEnd: explicitLineEnd,
	}
}
