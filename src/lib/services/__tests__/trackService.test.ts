// Mock 数据库相关模块
jest.mock('@/lib/db/db', () => ({
	__esModule: true,
	default: {},
	expoDb: {},
}))
jest.mock('@/utils/log')
jest.mock('@sentry/react-native', () => ({
	startSpan: jest.fn(<T>(_opts: unknown, fn: () => T): T => fn()),
}))

import type * as schema from '@/lib/db/schema'
import { TrackService } from '@/lib/services/trackService'
import type { BilibiliTrack, LocalTrack } from '@/types/core/media'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

type DBLike = ExpoSQLiteDatabase<typeof schema>

// Mock 数据库对象
const mockDb = {} as DBLike

describe('TrackService', () => {
	let service: TrackService

	beforeEach(() => {
		service = new TrackService(mockDb)
	})

	describe('formatTrack', () => {
		it('应该在输入为 null 时返回 null', () => {
			expect(service.formatTrack(null)).toBeNull()
		})

		it('应该在输入为 undefined 时返回 null', () => {
			expect(service.formatTrack(undefined)).toBeNull()
		})

		it('应该正确格式化 bilibili 来源的 track', () => {
			const mockDbTrack = {
				id: 1,
				uniqueKey: 'bilibili::BV123',
				title: '测试歌曲',
				artist: {
					id: 1,
					name: '测试歌手',
					source: 'bilibili' as const,
					remoteId: '123',
					avatarUrl: null,
					signature: null,
					createdAt: new Date('2024-01-01'),
					updatedAt: new Date('2024-01-01'),
				},
				coverUrl: 'https://example.com/cover.jpg',
				duration: 180,
				createdAt: new Date('2024-01-01'),
				updatedAt: new Date('2024-01-01'),
				source: 'bilibili' as const,
				artistId: 1,
				bilibiliMetadata: {
					id: 1,
					trackId: 1,
					bvid: 'BV123',
					cid: 456,
					isMultiPage: false,
					mainTrackTitle: null,
					videoIsValid: true,
				},
				localMetadata: null,
			}

			const result = service.formatTrack(mockDbTrack)

			expect(result).not.toBeNull()
			expect(result?.id).toBe(1)
			expect(result?.title).toBe('测试歌曲')
			expect(result?.source).toBe('bilibili')
			expect((result as BilibiliTrack)?.bilibiliMetadata).toBeDefined()
			expect((result as BilibiliTrack)?.bilibiliMetadata.bvid).toBe('BV123')
		})

		it('应该正确格式化 local 来源的 track', () => {
			const mockDbTrack = {
				id: 2,
				uniqueKey: 'local::/path/to/file.mp3',
				title: '本地歌曲',
				artist: null,
				coverUrl: null,
				duration: 240,
				createdAt: new Date('2024-01-01'),
				updatedAt: new Date('2024-01-01'),
				source: 'local' as const,
				artistId: null,
				bilibiliMetadata: null,
				localMetadata: {
					id: 1,
					trackId: 2,
					localPath: '/path/to/file.mp3',
				},
			}

			const result = service.formatTrack(mockDbTrack)

			expect(result).not.toBeNull()
			expect(result?.id).toBe(2)
			expect(result?.title).toBe('本地歌曲')
			expect(result?.source).toBe('local')
			expect((result as LocalTrack)?.localMetadata).toBeDefined()
			expect((result as LocalTrack)?.localMetadata.localPath).toBe(
				'/path/to/file.mp3',
			)
		})

		it('应该在 source 和 metadata 不匹配时返回 null', () => {
			const mockDbTrack = {
				id: 3,
				uniqueKey: 'bilibili::BV123',
				title: '不一致的歌曲',
				artist: null,
				coverUrl: null,
				duration: 180,
				createdAt: new Date('2024-01-01'),
				updatedAt: new Date('2024-01-01'),
				source: 'bilibili' as const,
				artistId: null,
				bilibiliMetadata: null, // source 是 bilibili 但没有 bilibiliMetadata
				localMetadata: null,
			}

			const result = service.formatTrack(mockDbTrack)
			expect(result).toBeNull()
		})
	})

	describe('withDB', () => {
		it('应该返回一个新的 TrackService 实例', () => {
			const newMockDb = {} as DBLike
			const newService = service.withDB(newMockDb)

			expect(newService).toBeInstanceOf(TrackService)
			expect(newService).not.toBe(service)
		})
	})
})
