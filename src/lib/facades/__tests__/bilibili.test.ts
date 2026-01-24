// Mock API
const mockBilibiliApi = {
	getCollectionAllContents: jest.fn(),
	getVideoDetails: jest.fn(),
	getFavoriteListContents: jest.fn(),
}

jest.mock('@/lib/api/bilibili/api', () => ({
	bilibiliApi: mockBilibiliApi,
}))

jest.mock('@/lib/api/bilibili/utils', () => ({
	av2bv: (id: number) => `BV${id}`,
}))

import type { bilibiliApi } from '@/lib/api/bilibili/api'
import { BilibiliFacade } from '@/lib/facades/bilibili'
import { err, ok } from 'neverthrow'

describe('BilibiliFacade', () => {
	let facade: BilibiliFacade

	beforeEach(() => {
		jest.clearAllMocks()
		facade = new BilibiliFacade(
			mockBilibiliApi as unknown as typeof bilibiliApi,
		)
	})

	describe('fetchRemotePlaylistMetadata', () => {
		it('应该能获取合集(collection)的元数据', async () => {
			const mockMetadata = {
				title: '合集标题',
				intro: '合集简介',
				cover: 'http://cover.url',
			}
			mockBilibiliApi.getCollectionAllContents.mockResolvedValue(
				ok({ info: mockMetadata }),
			)

			const result = await facade.fetchRemotePlaylistMetadata(123, 'collection')

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toEqual({
					title: '合集标题',
					description: '合集简介',
					coverUrl: 'http://cover.url',
				})
			}
			expect(mockBilibiliApi.getCollectionAllContents).toHaveBeenCalledWith(123)
		})

		it('应该能获取多集视频(multi_page)的元数据', async () => {
			const mockMetadata = {
				title: '视频标题',
				desc: '视频简介',
				pic: 'http://pic.url',
			}
			mockBilibiliApi.getVideoDetails.mockResolvedValue(ok(mockMetadata))

			const result = await facade.fetchRemotePlaylistMetadata(456, 'multi_page')

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toEqual({
					title: '视频标题',
					description: '视频简介',
					coverUrl: 'http://pic.url',
				})
			}
			expect(mockBilibiliApi.getVideoDetails).toHaveBeenCalledWith('BV456')
		})

		it('应该能获取收藏夹(favorite)的元数据', async () => {
			const mockMetadata = {
				title: '收藏夹标题',
				intro: '收藏夹简介',
				cover: 'http://fav.cover',
			}
			mockBilibiliApi.getFavoriteListContents.mockResolvedValue(
				ok({ info: mockMetadata }),
			)

			const result = await facade.fetchRemotePlaylistMetadata(789, 'favorite')

			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toEqual({
					title: '收藏夹标题',
					description: '收藏夹简介',
					coverUrl: 'http://fav.cover',
				})
			}
			expect(mockBilibiliApi.getFavoriteListContents).toHaveBeenCalledWith(
				789,
				1,
			)
		})

		it('应该在收藏夹元数据为空时返回错误', async () => {
			mockBilibiliApi.getFavoriteListContents.mockResolvedValue(
				ok({ info: null }),
			)

			const result = await facade.fetchRemotePlaylistMetadata(789, 'favorite')

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.message).toContain('数据为空')
			}
		})

		it('应该在 API 返回错误时返回 FacadeError', async () => {
			const error = new Error('API Error')
			mockBilibiliApi.getCollectionAllContents.mockResolvedValue(err(error))

			const result = await facade.fetchRemotePlaylistMetadata(123, 'collection')

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.type).toBe('fetchRemotePlaylistMetadataFailed')
			}
		})

		it('应该在未知类型时返回错误', async () => {
			const result = await facade.fetchRemotePlaylistMetadata(
				123,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
				'unknown' as any,
			)

			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error.message).toContain('未知的播放列表类型')
			}
		})
	})
})
