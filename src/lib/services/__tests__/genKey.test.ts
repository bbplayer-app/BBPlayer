jest.mock('@/utils/log')

import generateUniqueTrackKey from '@/lib/services/genKey'
import type { TrackSourceData } from '@/types/services/track'

describe('generateUniqueTrackKey', () => {
	describe('bilibili source', () => {
		it('应该为单页视频生成正确的唯一键', () => {
			const payload: TrackSourceData = {
				source: 'bilibili',
				bilibiliMetadata: {
					bvid: 'BV17x411w7KC',
					cid: 12345,
					isMultiPage: false,
					videoIsValid: true,
				},
			}

			const result = generateUniqueTrackKey(payload)
			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toBe('bilibili::BV17x411w7KC')
			}
		})

		it('应该为多页视频生成包含 cid 的唯一键', () => {
			const payload: TrackSourceData = {
				source: 'bilibili',
				bilibiliMetadata: {
					bvid: 'BV17x411w7KC',
					cid: 12345,
					isMultiPage: true,
					videoIsValid: true,
				},
			}

			const result = generateUniqueTrackKey(payload)
			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toBe('bilibili::BV17x411w7KC::12345')
			}
		})

		it('应该在缺少 bvid 时返回验证错误', () => {
			const payload: TrackSourceData = {
				source: 'bilibili',
				bilibiliMetadata: {
					bvid: '',
					cid: 12345,
					isMultiPage: false,
					videoIsValid: true,
				},
			}

			const result = generateUniqueTrackKey(payload)
			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})
	})

	describe('local source', () => {
		it('应该返回未实现错误', () => {
			const payload: TrackSourceData = {
				source: 'local',
				localMetadata: {
					localPath: '/path/to/file.mp3',
				},
			}

			const result = generateUniqueTrackKey(payload)
			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('NotImplemented')
			}
		})
	})

	describe('未知 source', () => {
		it('应该返回验证错误', () => {
			const payload = {
				source: 'unknown',
			} as unknown as TrackSourceData

			const result = generateUniqueTrackKey(payload)
			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})
	})
})
