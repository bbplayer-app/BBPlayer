import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { Track } from '@/types/core/media'
import log from '@/utils/log'
import { diffSets } from '@/utils/set'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

const logger = log.extend('Services.SyncLocalToBilibili')

class SyncLocalToBilibiliService {
	/**
	 * 通过名称查找远程收藏夹
	 */
	findRemotePlaylistByName(
		userMid: number,
		name: string,
	): ResultAsync<
		{ id: number; title: string; media_count: number } | null,
		Error
	> {
		return bilibiliApi.getFavoritePlaylists(userMid).map((list) => {
			const found = list.find((p) => p.title.trim() === name.trim())
			return found
				? { id: found.id, title: found.title, media_count: found.media_count }
				: null
		})
	}

	/**
	 * 创建新的远程收藏夹
	 */
	createRemotePlaylist(
		name: string,
		intro?: string,
	): ResultAsync<{ id: number }, Error> {
		return bilibiliApi.createFavoriteFolder(name, intro).map((res) => ({
			id: res.id,
		}))
	}

	/**
	 * 计算同步差异
	 * 策略：镜像同步（远程将与本地一致），远程多余的项将被移除。
	 * 返回两组 bvid 用于后续操作
	 */
	async calculateSyncDiff(
		localTracks: Track[],
		remotePlaylistId: number,
	): Promise<
		ResultAsync<
			{
				toAdd: string[]
				toRemove: string[]
			},
			Error
		>
	> {
		// 1. 获取所有远程内容
		const remoteContentsResult =
			await bilibiliApi.getFavoriteListAllContents(remotePlaylistId)

		if (remoteContentsResult.isErr()) {
			return errAsync(remoteContentsResult.error)
		}

		const remoteBvids = new Set(remoteContentsResult.value.map((i) => i.bvid))

		// 2. 筛选本地 B 站来源的歌曲
		const validLocalTracks = localTracks.filter(
			(t): t is Track & { source: 'bilibili' } =>
				t.source === 'bilibili' && !!t.bilibiliMetadata?.bvid,
		)

		const localBvids = new Set(
			validLocalTracks.map((t) => t.bilibiliMetadata.bvid),
		)

		// 3. 对比差异
		const { added: addedBvids, removed: removedBvids } = diffSets(
			remoteBvids, // source
			localBvids, // target
		)

		return okAsync({
			toAdd: Array.from(addedBvids),
			toRemove: Array.from(removedBvids),
		})
	}

	/**
	 * 批量添加歌曲到远程收藏夹
	 */
	async executeBatchAdd(
		folderId: number,
		bvidsToAdd: string[],
		onProgress?: (curr: number) => void,
	): Promise<ResultAsync<number, Error>> {
		let successCount = 0
		let failCount = 0

		const CONCURRENCY = 1
		const queue = [...bvidsToAdd]

		const sleep = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms))

		const worker = async () => {
			while (queue.length > 0) {
				const bvid = queue.shift()
				if (!bvid) break

				// 添加到 folderId，不从任何文件夹移除
				const res = await bilibiliApi.dealFavoriteForOneVideo(
					bvid,
					[String(folderId)],
					[],
				)

				if (res.isOk()) {
					successCount++
				} else {
					logger.warning(
						`Failed to add ${bvid} to folder ${folderId}`,
						res.error,
					)
					failCount++
				}
				onProgress?.(successCount + failCount)

				// 添加延时防止风控
				await sleep(300)
			}
		}

		await Promise.all(
			Array(CONCURRENCY)
				.fill(0)
				.map(() => worker()),
		)

		if (failCount > 0) {
			logger.warning(
				`Batch add completed with ${failCount} failures out of ${bvidsToAdd.length}`,
			)
		}
		return okAsync(failCount)
	}

	/**
	 * 批量从远程收藏夹移除歌曲
	 */
	async executeBatchRemove(
		folderId: number,
		tokensToRemove: string[],
	): Promise<ResultAsync<void, Error>> {
		if (tokensToRemove.length === 0) return okAsync(void 0)

		// API 限制分块
		const CHUNK_SIZE = 20
		for (let i = 0; i < tokensToRemove.length; i += CHUNK_SIZE) {
			const chunk = tokensToRemove.slice(i, i + CHUNK_SIZE)
			const res = await bilibiliApi.batchDeleteFavoriteListContents(
				folderId,
				chunk,
			)
			if (res.isErr()) {
				return errAsync(res.error)
			}
		}
		return okAsync(void 0)
	}
}

export const syncLocalToBilibiliService = new SyncLocalToBilibiliService()
