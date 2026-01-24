// Mock modules
jest.mock('@/lib/db/db', () => ({
	__esModule: true,
	default: {},
	expoDb: {},
}))
jest.mock('@/utils/log')
jest.mock('@sentry/react-native', () => ({
	startSpan: jest.fn(<T>(_opts: unknown, fn: () => T): T => fn()),
}))
jest.mock('@/lib/api/bilibili/api', () => ({
	bilibiliApi: {
		getCollectionAllContents: jest.fn(),
		getVideoDetails: jest.fn(),
		getFavoriteListContents: jest.fn(),
	},
}))
jest.mock('@/lib/api/bilibili/utils', () => ({
	av2bv: (id: number) => `BV${id}`,
	bv2av: (id: string) => parseInt(id.replace('BV', ''), 10) || 0,
}))
jest.mock('@/utils/toast', () => ({
	show: jest.fn(),
	hide: jest.fn(),
}))

import { bilibiliApi } from '@/lib/api/bilibili/api'
import type * as schema from '@/lib/db/schema'
import { SyncFacade } from '@/lib/facades/sync'
import type { ArtistService } from '@/lib/services/artistService'
import type { PlaylistService } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import type {
	BilibiliCollectionAllContents,
	BilibiliVideoDetails,
} from '@/types/apis/bilibili'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { okAsync } from 'neverthrow'

// Mock 依赖
const mockTrackService = {
	findOrCreateTrack: jest.fn(),
	getTrackByUniqueKey: jest.fn(),
	findTrackIdsByUniqueKeys: jest.fn(),
	findOrCreateManyTracks: jest.fn(),
	withDB: jest.fn().mockReturnThis(),
} as unknown as jest.Mocked<TrackService>

const mockPlaylistService = {
	findOrCreateRemotePlaylist: jest.fn(),
	replacePlaylistAllTracks: jest.fn(),
	withDB: jest.fn().mockReturnThis(),
} as unknown as jest.Mocked<PlaylistService>

const mockArtistService = {
	findOrCreateArtist: jest.fn(),
	findOrCreateManyRemoteArtists: jest.fn(),
	withDB: jest.fn().mockReturnThis(),
} as unknown as jest.Mocked<ArtistService>

const mockBilibiliApi = bilibiliApi as jest.Mocked<typeof bilibiliApi>

const mockDb = {
	transaction: jest.fn((callback: (tx: unknown) => unknown) =>
		callback('mockTx'),
	),
} as unknown as ExpoSQLiteDatabase<typeof schema>

describe('SyncFacade', () => {
	let facade: SyncFacade

	beforeEach(() => {
		jest.clearAllMocks()
		facade = new SyncFacade(
			mockTrackService,
			mockBilibiliApi,
			mockPlaylistService,
			mockArtistService,
			mockDb,
		)
	})

	describe('syncCollection (via dispatch)', () => {
		it('应该能同步合集', async () => {
			const collectionId = 123

			// Mock API response
			const mockCollectionData: Partial<BilibiliCollectionAllContents> = {
				info: {
					title: 'Collection',
					intro: 'Intro',
					cover: 'cover',
					upper: { name: 'Upper', mid: 999 },
				} as BilibiliCollectionAllContents['info'], // Partial mock for complex nested request
				medias: [
					{
						id: 1001,
						bvid: 'BV1001',
						title: 'Video 1',
						cover: 'v1.jpg',
						duration: 100,
						upper: { name: 'Upper', mid: 999 },
						// ... other fields
					} as NonNullable<BilibiliCollectionAllContents['medias']>[number],
				],
			}

			mockBilibiliApi.getCollectionAllContents.mockReturnValue(
				okAsync(mockCollectionData as BilibiliCollectionAllContents),
			)

			// Mock Service responses
			// 模拟 findOrCreateRemotePlaylist 返回值
			const mockPlaylist = {
				id: 1,
			} as typeof schema.playlists.$inferSelect

			mockPlaylistService.findOrCreateRemotePlaylist.mockReturnValue(
				okAsync(mockPlaylist),
			)

			// 模拟 findOrCreateArtist 返回值
			const mockArtist = {
				id: 99,
			} as typeof schema.artists.$inferSelect

			mockArtistService.findOrCreateArtist.mockReturnValue(okAsync(mockArtist))

			// 模拟 findOrCreateManyRemoteArtists 返回值
			const mockArtistsMap = new Map([
				['999', { id: 9 } as typeof schema.artists.$inferSelect],
			])

			mockArtistService.findOrCreateManyRemoteArtists.mockReturnValue(
				okAsync(mockArtistsMap),
			)

			// 模拟 findOrCreateManyTracks 返回值

			mockTrackService.findOrCreateManyTracks.mockReturnValue(
				okAsync(new Map([['bilibili::BV1001', 101]])),
			)

			mockPlaylistService.replacePlaylistAllTracks.mockReturnValue(
				okAsync(true),
			)

			const result = await facade.sync(collectionId, 'collection')

			if (result.isErr()) {
				console.error(
					'syncCollection test failed:',
					JSON.stringify(result.error, null, 2),
				)
			}

			expect(result.isOk()).toBe(true)
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockBilibiliApi.getCollectionAllContents).toHaveBeenCalledWith(
				collectionId,
			)

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlaylistService.findOrCreateRemotePlaylist).toHaveBeenCalled()

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlaylistService.replacePlaylistAllTracks).toHaveBeenCalled()
		})
	})

	describe('syncMultiPageVideo (via dispatch)', () => {
		it('应该能同步多集视频', async () => {
			const bvid_id = 456
			const bvid = 'BV456' // mapped by mock

			// Mock API
			const mockVideoData: Partial<BilibiliVideoDetails> = {
				title: 'MultiPart Video',
				desc: 'Desc',
				pic: 'pic',
				owner: { name: 'Owner', mid: 888, face: 'face' },
				pages: [
					{ cid: 1, part: 'P1', duration: 10 },
					{ cid: 2, part: 'P2', duration: 20 },
				],
			} as unknown as BilibiliVideoDetails

			mockBilibiliApi.getVideoDetails.mockReturnValue(
				okAsync(mockVideoData as BilibiliVideoDetails),
			)

			// Mock Services
			const mockPlaylist = {
				id: 2,
			} as typeof schema.playlists.$inferSelect

			mockPlaylistService.findOrCreateRemotePlaylist.mockReturnValue(
				okAsync(mockPlaylist),
			)

			const mockArtist = {
				id: 88,
			} as typeof schema.artists.$inferSelect

			mockArtistService.findOrCreateArtist.mockReturnValue(okAsync(mockArtist))

			const mockArtistsMap = new Map([
				['888', { id: 8 } as typeof schema.artists.$inferSelect],
			])

			mockArtistService.findOrCreateManyRemoteArtists.mockReturnValue(
				okAsync(mockArtistsMap),
			)

			mockTrackService.findOrCreateManyTracks.mockReturnValue(
				okAsync(
					new Map([
						[`bilibili::${bvid}::1`, 201],
						[`bilibili::${bvid}::2`, 202],
					]),
				),
			)

			mockPlaylistService.replacePlaylistAllTracks.mockReturnValue(
				okAsync(true),
			)

			const result = await facade.sync(bvid_id, 'multi_page')

			expect(result.isOk()).toBe(true)

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockBilibiliApi.getVideoDetails).toHaveBeenCalledWith(bvid)

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockPlaylistService.replacePlaylistAllTracks).toHaveBeenCalled()
		})
	})
})
