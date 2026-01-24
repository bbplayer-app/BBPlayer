// Mock 数据库
jest.mock('@/lib/db/db', () => ({
	__esModule: true,
	default: {},
	expoDb: {},
}))
jest.mock('@/utils/log')
jest.mock('@sentry/react-native', () => ({
	startSpan: jest.fn(<T>(_opts: unknown, fn: () => T): T => fn()),
}))
// Mock bilibili api to prevent transitive import of zustand/immer which causes ESM errors
jest.mock('@/lib/api/bilibili/api', () => ({
	bilibiliApi: {},
}))

import type { bilibiliApi } from '@/lib/api/bilibili/api'
import type * as schema from '@/lib/db/schema'
import { PlaylistFacade } from '@/lib/facades/playlist'
import type { ArtistService } from '@/lib/services/artistService'
import type { PlaylistService } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { okAsync } from 'neverthrow'

// Mock 依赖
const mockTrackService = {
	findOrCreateTrack: jest.fn(),
	getTrackByUniqueKey: jest.fn(),
	findTrackIdsByUniqueKeys: jest.fn(),
	withDB: jest.fn().mockReturnThis(),
} as unknown as jest.Mocked<TrackService>

const mockPlaylistService = {
	getPlaylistMetadata: jest.fn(),
	getPlaylistById: jest.fn(),
	getPlaylistTracks: jest.fn(),
	createPlaylist: jest.fn(),
	addManyTracksToLocalPlaylist: jest.fn(),
	batchRemoveTracksFromLocalPlaylist: jest.fn(),
	replacePlaylistAllTracks: jest.fn(),
	withDB: jest.fn().mockReturnThis(),
} as unknown as jest.Mocked<PlaylistService>

const mockArtistService = {
	findOrCreateArtist: jest.fn(),
	withDB: jest.fn().mockReturnThis(),
} as unknown as jest.Mocked<ArtistService>

const mockBilibiliApi = {} as unknown as typeof bilibiliApi
// Mock db.transaction to execute the callback immediately
const mockDb = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
	transaction: jest.fn((callback: (tx: any) => any) => callback('mockTx')),
} as unknown as ExpoSQLiteDatabase<typeof schema>

describe('PlaylistFacade', () => {
	let facade: PlaylistFacade

	beforeEach(() => {
		jest.clearAllMocks()
		facade = new PlaylistFacade(
			mockTrackService,
			mockBilibiliApi,
			mockPlaylistService,
			mockArtistService,
			mockDb,
		)
	})

	describe('duplicatePlaylist', () => {
		it('应该能成功复制播放列表', async () => {
			const sourcePlaylistId = 1
			const newName = 'New Playlist'
			const mockMetadata: Partial<typeof schema.playlists.$inferSelect> = {
				id: 1,
				title: 'Old Playlist',
				description: 'Desc',
				coverUrl: 'url',
				authorId: null,
				itemCount: 5,
			}
			const mockTracks = [{ id: 101 }, { id: 102 }]
			const newPlaylist = { id: 2 }

			mockPlaylistService.getPlaylistById.mockReturnValue(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
				okAsync(mockMetadata as any),
			)
			mockPlaylistService.getPlaylistTracks.mockReturnValue(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
				okAsync(mockTracks as any),
			)
			mockPlaylistService.createPlaylist.mockReturnValue(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
				okAsync(newPlaylist as any),
			)
			mockPlaylistService.addManyTracksToLocalPlaylist.mockReturnValue(
				okAsync([]),
			)
			mockPlaylistService.replacePlaylistAllTracks.mockReturnValue(
				okAsync(true),
			)

			const result = await facade.duplicatePlaylist(sourcePlaylistId, newName)

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toBe(2)
			}

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlaylistService.createPlaylist).toHaveBeenCalledWith({
				title: newName,
				description: 'Desc',
				coverUrl: 'url',
				type: 'local',
				authorId: null,
				remoteSyncId: null,
			})
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlaylistService.replacePlaylistAllTracks).toHaveBeenCalledWith(
				2,
				[101, 102],
			)
		})

		it('应该在源播放列表不存在时返回错误', async () => {
			mockPlaylistService.getPlaylistById.mockReturnValue(okAsync(undefined))

			const result = await facade.duplicatePlaylist(1, 'name')

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('PlaylistDuplicateFailed')
			}
		})
	})

	describe('saveQueueAsPlaylist', () => {
		it('应该能将队列保存为新播放列表', async () => {
			const name = 'Queue Playlist'
			const uniqueKeys = ['u1', 'u2']
			const newPlaylist = { id: 3 }
			const foundTracks = new Map([
				['u1', 101],
				['u2', 102],
			])

			mockPlaylistService.createPlaylist.mockReturnValue(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
				okAsync(newPlaylist as any),
			)
			mockTrackService.findTrackIdsByUniqueKeys.mockReturnValue(
				okAsync(foundTracks),
			)
			mockPlaylistService.addManyTracksToLocalPlaylist.mockReturnValue(
				okAsync([]),
			)

			const result = await facade.saveQueueAsPlaylist(name, uniqueKeys)

			expect(result.isOk()).toBe(true)
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlaylistService.createPlaylist).toHaveBeenCalledWith(
				expect.objectContaining({ title: name }),
			)
			expect(
				// eslint-disable-next-line @typescript-eslint/unbound-method
				mockPlaylistService.addManyTracksToLocalPlaylist,
			).toHaveBeenCalledWith(3, [101, 102])
		})
	})

	describe('updateTrackLocalPlaylists', () => {
		it('应该能更新 track 的播放列表归属', async () => {
			const params = {
				toAddPlaylistIds: [1],
				toRemovePlaylistIds: [2],
				trackPayload: {
					source: 'bilibili' as const,
					title: 'Track',
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
					bilibiliMetadata: {} as any,
				},
			}
			const mockTrack = { id: 100, uniqueKey: 'u100' }

			mockTrackService.findOrCreateTrack.mockReturnValue(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
				okAsync(mockTrack as any),
			)
			mockPlaylistService.addManyTracksToLocalPlaylist.mockReturnValue(
				okAsync([]),
			)
			mockPlaylistService.batchRemoveTracksFromLocalPlaylist.mockReturnValue(
				okAsync({ removedTrackIds: [], missingTrackIds: [] }),
			)

			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
			const result = await facade.updateTrackLocalPlaylists(params as any)

			expect(result.isOk()).toBe(true)
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockTrackService.findOrCreateTrack).toHaveBeenCalled()
			expect(
				// eslint-disable-next-line @typescript-eslint/unbound-method
				mockPlaylistService.addManyTracksToLocalPlaylist,
			).toHaveBeenCalledWith(1, [100])
			expect(
				// eslint-disable-next-line @typescript-eslint/unbound-method
				mockPlaylistService.batchRemoveTracksFromLocalPlaylist,
			).toHaveBeenCalledWith(2, [100])
		})
	})
})
