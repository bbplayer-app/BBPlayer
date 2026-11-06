import type { LyricLine } from '@bbplayer/splash'

import type {
	BilibiliSubtitleBody,
	BilibiliSubtitleTrack,
} from '@/types/apis/bilibili'

export function subtitleKind(track: BilibiliSubtitleTrack) {
	if (track.ai_type === 1) return '机翻'
	if (track.lan.startsWith('ai-')) return '自动生成'
	return '人工字幕'
}

export function subtitleLabel(track: BilibiliSubtitleTrack) {
	return `${track.lan_doc || track.lan} · ${subtitleKind(track)}`
}

const baseLanguage = (lan: string) =>
	lan.replace(/^ai-/, '').split('-')[0]?.toLowerCase()

/** Keep the chosen variant when available, then prefer the same language. */
export function selectSubtitle(
	tracks: BilibiliSubtitleTrack[],
	language?: string,
) {
	const matchingLanguage = language
		? tracks.filter(
				(track) => baseLanguage(track.lan) === baseLanguage(language),
			)
		: []
	return (
		tracks.find((track) => track.lan === language) ??
		matchingLanguage.find(
			(track) => !track.ai_type && !track.lan.startsWith('ai-'),
		) ??
		matchingLanguage[0] ??
		tracks.find(
			(track) => /^(zh|cmn)(-|$)/.test(track.lan) && !track.ai_type,
		) ??
		tracks.find((track) => !track.ai_type && !track.lan.startsWith('ai-')) ??
		tracks.find((track) => /^(ai-)?zh(-|$)/.test(track.lan)) ??
		tracks[0]
	)
}

export function subtitleLines(data?: BilibiliSubtitleBody): LyricLine[] {
	return (data?.body ?? [])
		.filter(
			(line) =>
				Number.isFinite(line?.from) &&
				Number.isFinite(line?.to) &&
				line.from >= 0 &&
				line.to > line.from &&
				typeof line.content === 'string' &&
				line.content.trim(),
		)
		.sort((a, b) => a.from - b.from)
		.map((line) => ({
			startTime: line.from * 1000,
			endTime: line.to * 1000,
			content: line.content.trim(),
			translations: [],
			isDynamic: false,
			spans: [],
		}))
}

export interface SubtitleParagraph {
	id: string
	startTime: number
	cues: { line: LyricLine; index: number }[]
	content: string
}

/** Group nearby cues for reading without losing their individual seek targets. */
export function subtitleParagraphs(lines: LyricLine[]): SubtitleParagraph[] {
	const paragraphs: SubtitleParagraph[] = []
	for (const [index, line] of lines.entries()) {
		let paragraph = paragraphs[paragraphs.length - 1]
		const previous = paragraph?.cues[paragraph.cues.length - 1]?.line
		const shouldBreak =
			!paragraph ||
			!previous ||
			line.startTime - previous.endTime > 1500 ||
			line.endTime - paragraph.startTime > 20000 ||
			paragraph.content.length + line.content.length > 240 ||
			paragraph.cues.length >= 8 ||
			(/[。！？.!?][”"’']?$/.test(previous.content) &&
				paragraph.content.length >= 80)
		if (shouldBreak) {
			paragraph = {
				id: `${index}:${line.startTime}`,
				startTime: line.startTime,
				cues: [],
				content: '',
			}
			paragraphs.push(paragraph)
		}
		paragraph.cues.push({ line, index })
		paragraph.content += `${paragraph.content ? subtitleSeparator(previous?.content ?? '', line.content) : ''}${line.content}`
	}
	return paragraphs
}

/** Bilibili's Chinese cues often omit punctuation; spaces preserve visible boundaries. */
export function subtitleSeparator(previous: string, next: string) {
	if (!previous || /^[，。！？、；：,.!?;:]/.test(next)) return ''
	return ' '
}

export function subtitleIndexAt(lines: LyricLine[], seconds: number) {
	let low = 0
	let high = lines.length - 1
	let result = 0
	while (low <= high) {
		const mid = Math.floor((low + high) / 2)
		if (lines[mid].startTime <= seconds * 1000) {
			result = mid
			low = mid + 1
		} else high = mid - 1
	}
	return result
}
