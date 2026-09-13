export interface Chapter {
	id: string
	title: string
	startSeconds: number
	endSeconds: number
}

export interface VideoViewPoint {
	type?: number
	from: number
	to: number
	content: string
}

export function normalizeChapters(
	points: VideoViewPoint[] | undefined,
	duration: number,
): Chapter[] {
	if (!Number.isFinite(duration) || duration <= 0) return []
	const sorted = (Array.isArray(points) ? points : [])
		.filter(
			(point) =>
				Number.isFinite(point.from) &&
				Number.isFinite(point.to) &&
				point.from >= 0 &&
				point.from < duration &&
				point.to > point.from &&
				typeof point.content === 'string' &&
				point.content.trim().length > 0,
		)
		.sort((a, b) => a.from - b.from)
		.filter(
			(point, index, all) => index === 0 || point.from !== all[index - 1].from,
		)
	return sorted.map((point, index) => {
		// Bilibili chapter times use whole seconds; media duration can include
		// a fractional tail (and the metadata duration can round up).
		const terminalEnd =
			index === sorted.length - 1 && duration - point.to <= 1
				? duration
				: point.to
		return {
			id: `${point.from}:${index}`,
			title: point.content.trim(),
			startSeconds: point.from,
			endSeconds: Math.min(
				terminalEnd,
				duration,
				sorted[index + 1]?.from ?? duration,
			),
		}
	})
}

export function chapterIndexAt(chapters: Chapter[], seconds: number): number {
	'worklet'
	let low = 0
	let high = chapters.length - 1
	let result = -1
	while (low <= high) {
		const middle = (low + high) >>> 1
		if (chapters[middle].startSeconds <= seconds) {
			result = middle
			low = middle + 1
		} else high = middle - 1
	}
	if (result < 0) return -1
	return seconds < chapters[result].endSeconds ? result : -1
}

export function chapterBoundaries(
	chapters: Chapter[],
	duration: number,
): number[] {
	if (!Number.isFinite(duration) || duration <= 0) return []
	return [
		...new Set(
			chapters.flatMap((chapter) => [chapter.startSeconds, chapter.endSeconds]),
		),
	]
		.filter((time) => time > 0 && time < duration)
		.sort((a, b) => a - b)
		.map((time) => time / duration)
}

/** Number of boundaries at or before a drag position, including gaps between chapters. */
export function chapterBoundaryIndex(
	markers: number[],
	fraction: number,
): number {
	'worklet'
	let low = 0
	let high = markers.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if (markers[middle] <= fraction) low = middle + 1
		else high = middle
	}
	return low
}
