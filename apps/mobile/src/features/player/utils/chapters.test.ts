import { describe, expect, it } from '@jest/globals'

import {
	chapterBoundaries,
	chapterBoundaryIndex,
	chapterIndexAt,
	normalizeChapters,
} from './chapters'

describe('video chapters', () => {
	it('works without toSorted and preserves the input array', () => {
		const descriptor = Object.getOwnPropertyDescriptor(
			Array.prototype,
			'toSorted',
		)
		const points = [
			{ from: 30, to: 60, content: '第二章' },
			{ from: 0, to: 30, content: '第一章' },
		]
		const original = points.map((point) => ({ ...point }))
		let chapters: ReturnType<typeof normalizeChapters>
		// Temporarily match the device runtime, restoring its descriptor in finally.
		/* eslint-disable no-extend-native */
		try {
			Object.defineProperty(Array.prototype, 'toSorted', {
				configurable: true,
				value: undefined,
			})
			chapters = normalizeChapters(points, 60)
		} finally {
			if (descriptor)
				Object.defineProperty(Array.prototype, 'toSorted', descriptor)
			else Reflect.deleteProperty(Array.prototype, 'toSorted')
		}
		/* eslint-enable no-extend-native */
		expect(chapters.map((chapter) => chapter.startSeconds)).toEqual([0, 30])
		expect(points).toEqual(original)
	})

	it('accepts type 2 chapters and sorts, deduplicates and clamps their ranges', () => {
		const chapters = normalizeChapters(
			[
				{ type: 2, from: 78, to: 400, content: '  第二章  ' },
				{ type: 2, from: 0, to: 100, content: '开场' },
				{ type: 2, from: 78, to: 200, content: '重复' },
				{ type: 2, from: 240, to: 800, content: '总结' },
			],
			300,
		)
		expect(
			chapters.map(({ title, startSeconds, endSeconds }) => [
				title,
				startSeconds,
				endSeconds,
			]),
		).toEqual([
			['开场', 0, 78],
			['第二章', 78, 240],
			['总结', 240, 300],
		])
		expect(chapterBoundaries(chapters, 300)).toEqual([78 / 300, 240 / 300])
		expect(chapterIndexAt(chapters, 77.999)).toBe(0)
		expect(chapterIndexAt(chapters, 78)).toBe(1)
	})

	it('does not invent chapters in uncovered intervals and detects drags across gaps', () => {
		const chapters = normalizeChapters(
			[
				{ from: 10, to: 20, content: '片段一' },
				{ from: 40, to: 50, content: '片段二' },
			],
			100,
		)
		expect(chapterIndexAt(chapters, 0)).toBe(-1)
		expect(chapterIndexAt(chapters, 20)).toBe(-1)
		expect(chapterIndexAt(chapters, 45)).toBe(1)
		const markers = chapterBoundaries(chapters, 100)
		expect(markers).toEqual([0.1, 0.2, 0.4, 0.5])
		expect(chapterBoundaryIndex(markers, 0.05)).toBe(0)
		expect(chapterBoundaryIndex(markers, 0.6)).toBe(4)
		expect(chapterBoundaryIndex(markers, 0.4)).toBe(3)
	})

	it('does not mark the rounded final second as a chapter boundary (BV1bYY463EHT)', () => {
		const starts = [0, 274, 564, 770, 932, 1164, 1504]
		const points = starts.map((from, index) => ({
			from,
			to: starts[index + 1] ?? 1786,
			content: `Chapter ${index + 1}`,
		}))
		for (const duration of [1786.474, 1787]) {
			const chapters = normalizeChapters(points, duration)
			expect(chapterBoundaries(chapters, duration)).toEqual(
				starts.slice(1).map((time) => time / duration),
			)
			expect(chapterIndexAt(chapters, duration - 0.1)).toBe(6)
		}
	})

	it('discards malformed, reversed, out-of-range and untitled chapter data', () => {
		expect(
			normalizeChapters(
				[
					{ from: NaN, to: 20, content: 'bad' },
					{ from: 0, to: Infinity, content: 'bad' },
					{ from: -1, to: 10, content: 'bad' },
					{ from: 20, to: 10, content: 'bad' },
					{ from: 100, to: 200, content: 'bad' },
					{ from: 0, to: 10, content: '  ' },
				],
				100,
			),
		).toEqual([])
		expect(normalizeChapters(undefined, 100)).toEqual([])
		expect(
			normalizeChapters([{ from: 0, to: 20, content: 'chapter' }], 0),
		).toEqual([])
		expect(normalizeChapters([], Infinity)).toEqual([])
	})
})
