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
import { ArtistService } from '@/lib/services/artistService'
import type { TrackService } from '@/lib/services/trackService'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

type DBLike = ExpoSQLiteDatabase<typeof schema>

// Mock 数据库对象
const mockDb = {} as DBLike
const mockTrackService = {
	withDB: jest.fn(),
	formatTrack: jest.fn(),
} as unknown as TrackService

describe('ArtistService', () => {
	let service: ArtistService

	beforeEach(() => {
		jest.clearAllMocks()
		;(mockTrackService.withDB as jest.Mock).mockReturnValue(mockTrackService)
		service = new ArtistService(mockDb, mockTrackService)
	})

	describe('withDB', () => {
		it('应该返回一个新的 ArtistService 实例', () => {
			const newMockDb = {} as DBLike
			const newService = service.withDB(newMockDb)

			expect(newService).toBeInstanceOf(ArtistService)
			expect(newService).not.toBe(service)

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockTrackService.withDB as jest.Mock).toHaveBeenCalledWith(
				newMockDb,
			)
		})
	})

	describe('findOrCreateArtist', () => {
		it('应该在缺少 source 时返回验证错误', async () => {
			const result = await service.findOrCreateArtist({
				name: '测试艺术家',
				source: '' as 'bilibili',
				remoteId: '123',
			})

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})

		it('应该在缺少 remoteId 时返回验证错误', async () => {
			const result = await service.findOrCreateArtist({
				name: '测试艺术家',
				source: 'bilibili',
				remoteId: '',
			})

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})
	})

	describe('findOrCreateManyRemoteArtists', () => {
		it('应该在 payloads 为空数组时返回空 Map', async () => {
			const result = await service.findOrCreateManyRemoteArtists([])

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toBeInstanceOf(Map)
				expect(result.value.size).toBe(0)
			}
		})

		it('应该在 payloads 中存在 source 为空的对象时返回验证错误', async () => {
			const result = await service.findOrCreateManyRemoteArtists([
				{ name: '艺术家1', source: 'bilibili', remoteId: '123' },
				{ name: '艺术家2', source: '' as 'bilibili', remoteId: '456' },
			])

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})

		it('应该在 payloads 中存在 remoteId 为空的对象时返回验证错误', async () => {
			const result = await service.findOrCreateManyRemoteArtists([
				{ name: '艺术家1', source: 'bilibili', remoteId: '123' },
				{ name: '艺术家2', source: 'bilibili', remoteId: '' },
			])

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})
	})
})
