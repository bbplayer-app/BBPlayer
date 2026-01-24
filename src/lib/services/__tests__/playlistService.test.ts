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
import { PlaylistService } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

type DBLike = ExpoSQLiteDatabase<typeof schema>

// Mock 数据库对象
const mockDb = {} as DBLike
const mockTrackService = {
	withDB: jest.fn(),
	formatTrack: jest.fn(),
} as unknown as TrackService

describe('PlaylistService', () => {
	let service: PlaylistService

	beforeEach(() => {
		jest.clearAllMocks()
		;(mockTrackService.withDB as jest.Mock).mockReturnValue(mockTrackService)
		service = new PlaylistService(mockDb, mockTrackService)
	})

	describe('withDB', () => {
		it('应该返回一个新的 PlaylistService 实例', () => {
			const newMockDb = {} as DBLike
			const newService = service.withDB(newMockDb)

			expect(newService).toBeInstanceOf(PlaylistService)
			expect(newService).not.toBe(service)

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockTrackService.withDB as jest.Mock).toHaveBeenCalledWith(
				newMockDb,
			)
		})
	})

	describe('addManyTracksToLocalPlaylist', () => {
		it('应该在 trackIds 为空数组时直接返回空数组', async () => {
			const result = await service.addManyTracksToLocalPlaylist(1, [])

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toEqual([])
			}
		})
	})

	describe('reorderSingleLocalPlaylistTrack', () => {
		it('应该在 fromOrder 等于 toOrder 时直接返回 true', async () => {
			const result = await service.reorderSingleLocalPlaylistTrack(1, {
				trackId: 1,
				fromOrder: 5,
				toOrder: 5,
			})

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toBe(true)
			}
		})
	})

	describe('findOrCreateRemotePlaylist', () => {
		it('应该在 remoteSyncId 为空时返回验证错误', async () => {
			const result = await service.findOrCreateRemotePlaylist({
				title: '测试播放列表',
				type: 'local',
			})

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})

		it('应该在 type 为 local 时返回验证错误', async () => {
			const result = await service.findOrCreateRemotePlaylist({
				title: '测试播放列表',
				type: 'local',
				remoteSyncId: 123,
			})

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('Validation')
			}
		})
	})
})
