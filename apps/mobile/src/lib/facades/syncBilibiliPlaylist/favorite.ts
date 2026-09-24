import { err, ok, Result, ResultAsync } from 'neverthrow'

import { createFacadeError, type FacadeError } from '@/lib/errors/facade'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import type {
	BilibiliFavoriteListContent,
	BilibiliMultipageVideo,
} from '@/types/apis/bilibili'
import type { BilibiliTrack } from '@/types/core/media'

import { persistFavoriteSync } from './favoritePersist'
import {
	buildExpandedTracksMap,
	buildLocalGrouped,
	buildMainInfoMap,
	planFavoriteSync,
	selectBvidsToQuery,
} from './favoritePlan'
import type {
	FavoriteExpansion,
	FavoriteRemoteApi,
	FavoriteSyncDeps,
	FavoriteSyncPlan,
	FavoriteTrackDetails,
	LocalFavoriteState,
	RemoteFavoriteSnapshot,
	SyncLogger,
} from './types'

const PAGE_LIST_CONCURRENCY = 6

/**
 * 并发获取一批 bvid 的分 P 列表。
 * ResponseFailed（视频失效等业务性失败）的 bvid 折叠为单条跳过，记录在 skippedBvids；
 * 网络类失败（RequestFailed/RequestAborted）则整体失败
 */
async function fetchPageLists(
	getPageList: FavoriteRemoteApi['getPageList'],
	bvids: string[],
	logger: SyncLogger,
): Promise<
	Result<
		{
			pageLists: Map<string, BilibiliMultipageVideo[]>
			skippedBvids: string[]
		},
		BilibiliApiError
	>
> {
	const results = new Map<string, BilibiliMultipageVideo[]>()
	const skippedBvids: string[] = []
	let index = 0
	let firstError: BilibiliApiError | null = null
	const worker = async () => {
		while (index < bvids.length && !firstError) {
			const bvid = bvids[index]
			index += 1
			// oxlint-disable-next-line no-await-in-loop
			const res = await getPageList({ bvid })
			if (res.isErr()) {
				if (res.error.type === 'ResponseFailed') {
					logger.warning('获取分 P 列表失败，折叠为单条', {
						bvid,
						message: res.error.message,
					})
					skippedBvids.push(bvid)
					continue
				}
				firstError = res.error
				logger.error('展开分 P：分 P 列表查询失败', {
					bvid,
					type: res.error.type,
					message: res.error.message,
				})
				return
			}
			results.set(bvid, res.value)
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(PAGE_LIST_CONCURRENCY, bvids.length) }, () =>
			worker(),
		),
	)
	if (firstError) {
		return err(firstError)
	}
	return ok({ pageLists: results, skippedBvids })
}

/**
 * 阶段 1：从 bilibili 获取基本元数据和收藏夹所有 bvid
 */
export async function fetchRemoteFavoriteSnapshot(
	deps: Pick<FavoriteSyncDeps, 'api' | 'logger' | 'onProgress'>,
	favoriteId: number,
): Promise<Result<RemoteFavoriteSnapshot, BilibiliApiError | FacadeError>> {
	deps.onProgress?.({
		message: '正在获取收藏夹元数据...',
		stage: 'fetching_metadata',
	})
	const bilibiliResult = await ResultAsync.combine([
		deps.api.getFavoriteListAllContents({ favoriteId }),
		deps.api.getFavoriteListContents({ favoriteId, pn: 1 }),
	])
	if (bilibiliResult.isErr()) {
		return err(bilibiliResult.error)
	}
	const [allContents, firstPage] = bilibiliResult.value
	if (!firstPage.info) {
		return err(
			createFacadeError(
				'SyncFavoriteFailed',
				'同步收藏夹失败，数据为空，收藏夹可能不存在',
			),
		)
	}
	const allBvids = allContents.filter(
		(item) => item.type === 2, // 过滤非视频稿件 (type 2 is video)
	)
	deps.logger.debug(
		'step 1: 调用 bilibiliapi getFavoriteListAllContents 完成',
		{
			total: allBvids.length,
		},
	)
	return ok({
		metadata: firstPage.info,
		orderedBvids: new Set(allBvids.map((item) => item.bvid)),
	})
}

/**
 * 阶段 2：查询本地收藏夹元数据与已有 tracks
 */
export async function loadLocalFavoriteState(
	deps: Pick<FavoriteSyncDeps, 'playlistService' | 'logger' | 'onProgress'>,
	favoriteId: number,
): Promise<Result<LocalFavoriteState, FacadeError>> {
	const localPlaylist =
		await deps.playlistService.findPlaylistByTypeAndRemoteId(
			'favorite',
			favoriteId,
		)
	if (localPlaylist.isErr()) {
		return err(localPlaylist.error)
	}
	deps.logger.debug('step 2: 查询本地收藏夹元数据完成', {
		localPlaylistId: localPlaylist.value?.id ?? '不存在',
	})
	deps.onProgress?.({
		message: '正在比对本地数据...',
		stage: 'calculating_diff',
	})
	if (!localPlaylist.value || localPlaylist.value.itemCount === 0) {
		return ok({
			playlistId: localPlaylist.value?.id ?? null,
			tracks: [] as BilibiliTrack[],
		})
	}
	const existTracks = await deps.playlistService.getPlaylistTracks(
		localPlaylist.value.id,
	)
	if (existTracks.isErr()) {
		return err(existTracks.error)
	}
	if (existTracks.value.find((item) => item.source !== 'bilibili')) {
		return err(
			createFacadeError(
				'SyncFavoriteFailed',
				'同步收藏夹失败，收藏夹中存在非 Bilibili 的 Track，你的数据库似乎已经坏掉惹。',
			),
		)
	}
	return ok({
		playlistId: localPlaylist.value.id,
		tracks: existTracks.value as BilibiliTrack[],
	})
}

/**
 * 阶段 4：从第一页（最新）开始分页获取新增 bvid 的详细元数据。
 * 分页结束后仍未命中的 bvid 视为被 up 隐藏的稿件，从 orderedBvids 中剔除。
 */
export async function fetchFavoriteTrackDetails(
	deps: Pick<FavoriteSyncDeps, 'api' | 'logger' | 'onProgress'>,
	favoriteId: number,
	plan: Extract<FavoriteSyncPlan, { kind: 'sync' }>,
): Promise<Result<FavoriteTrackDetails, BilibiliApiError | FacadeError>> {
	const { api, logger, onProgress } = deps
	const bvidsToAddSet = new Set(plan.bvidsNeedingDetails)
	const totalToAdd = bvidsToAddSet.size
	onProgress?.({
		message: `准备同步 ${totalToAdd} 个新视频...`,
		current: 0,
		total: totalToAdd,
		stage: 'fetching_details',
	})

	const addedTracksMetadata = new Set<BilibiliFavoriteListContent>()
	let nowPageNumber = 0
	let hasMore = true
	let fetchedCount = 0

	while (hasMore) {
		if (bvidsToAddSet.size === 0) {
			break
		}
		nowPageNumber += 1
		onProgress?.({
			message: `正在获取第 ${nowPageNumber} 页详情...`,
			current: fetchedCount,
			total: totalToAdd,
			stage: 'fetching_details',
		})
		logger.debug('开始获取第 ' + nowPageNumber + ' 页收藏夹内容')
		// oxlint-disable-next-line no-await-in-loop
		const pageResult = await api.getFavoriteListContents({
			favoriteId,
			pn: nowPageNumber,
		})
		if (pageResult.isErr()) {
			return err(pageResult.error)
		}
		const page = pageResult.value
		if (!page.medias) {
			return err(
				createFacadeError(
					'SyncFavoriteFailed',
					'同步收藏夹失败，该收藏夹中没有任何 track',
				),
			)
		}
		logger.debug(page.medias.length)
		hasMore = page.has_more
		for (const item of page.medias) {
			if (bvidsToAddSet.has(item.bvid)) {
				addedTracksMetadata.add(item)
				bvidsToAddSet.delete(item.bvid)
				fetchedCount++
			}
		}
		onProgress?.({
			message: `已获取 ${fetchedCount}/${totalToAdd} 个视频详情...`,
			current: fetchedCount,
			total: totalToAdd,
			stage: 'fetching_details',
		})
	}
	logger.debug('step 4: 获取要添加的 tracks 元数据完成', {
		added: addedTracksMetadata.size,
		requestApiTimes: nowPageNumber,
	})

	const orderedBvids = new Set(plan.orderedBvids)
	for (const bvid of bvidsToAddSet) {
		orderedBvids.delete(bvid)
	}
	return ok({
		metadata: addedTracksMetadata,
		orderedBvids,
		hiddenBvids: [...bvidsToAddSet],
	})
}

/**
 * 阶段 5：按需展开分 P。
 * 新增 bvid 与本地为折叠态的 bvid 需要查分 P 列表；本地已展开的 bvid 直接复用，不发请求。
 * 未开启展开时直接返回 { expandedTracksMap: null }。
 */
export async function buildExpandedTracks(
	deps: Pick<FavoriteSyncDeps, 'api' | 'logger' | 'onProgress'>,
	local: LocalFavoriteState,
	details: FavoriteTrackDetails,
	expandMultiPage: boolean,
): Promise<Result<FavoriteExpansion, BilibiliApiError | FacadeError>> {
	if (!expandMultiPage) {
		return ok({ expandedTracksMap: null })
	}
	const { api, logger, onProgress } = deps
	onProgress?.({
		message: '正在获取分 P 信息...',
		stage: 'fetching_details',
	})
	const localGrouped = buildLocalGrouped(local.tracks)
	const allBvids = Array.from(details.orderedBvids)
	const mainInfoMap = buildMainInfoMap(details.metadata, localGrouped)
	const toQueryBvids = selectBvidsToQuery(allBvids, localGrouped, mainInfoMap)
	logger.debug('展开分 P：统计', {
		total: allBvids.length,
		reused: allBvids.length - toQueryBvids.length,
		toQuery: toQueryBvids.length,
		singlePageSkipped: Array.from(mainInfoMap.values()).filter(
			(v) => v.pageCount !== undefined && v.pageCount <= 1,
		).length,
		locallyCollapsed: Array.from(mainInfoMap.values()).filter(
			(v) => !v.videoIsValid,
		).length,
	})
	const pageListsResult = await fetchPageLists(
		api.getPageList,
		toQueryBvids,
		logger,
	)
	if (pageListsResult.isErr()) {
		return err(pageListsResult.error)
	}
	const { pageLists, skippedBvids } = pageListsResult.value
	if (skippedBvids.length > 0) {
		logger.warning('展开分 P：以下视频查询失败，已折叠为单条', {
			bvids: skippedBvids,
		})
	}
	const expandedTracksMapResult = buildExpandedTracksMap(
		allBvids,
		localGrouped,
		mainInfoMap,
		pageLists,
	)
	if (expandedTracksMapResult.isErr()) {
		return err(expandedTracksMapResult.error)
	}
	logger.debug('step 5: 展开分 P 视频完成', {
		total: allBvids.length,
	})
	return ok({ expandedTracksMap: expandedTracksMapResult.value })
}

/**
 * 收藏夹同步总编排：把各阶段函数组合起来，只保留唯一的 noop 早退分支。
 * 流程：远端快照 → 本地快照 → 计算计划 → (noop 早退) → 补详情 → 展开分 P → 落库。
 */
export async function runFavoriteSync(
	deps: FavoriteSyncDeps,
	favoriteId: number,
	expandMultiPage = false,
): Promise<Result<number | undefined, FacadeError | BilibiliApiError>> {
	const remote = await fetchRemoteFavoriteSnapshot(deps, favoriteId)
	if (remote.isErr()) {
		return err(remote.error)
	}
	const local = await loadLocalFavoriteState(deps, favoriteId)
	if (local.isErr()) {
		return err(local.error)
	}

	const plan = planFavoriteSync(remote.value, local.value, expandMultiPage)
	deps.logger.debug('step 3: 对远程和本地的 tracks 进行 diff 完成', {
		added: plan.stats.added,
		removed: plan.stats.removed,
	})
	deps.logger.info('收藏夹变更统计', {
		added: plan.stats.added,
		removed: plan.stats.removed,
	})
	if (plan.kind === 'noop') {
		deps.logger.info('收藏夹为空或与上次相比无变化，无需同步')
		return ok(plan.playlistId)
	}
	if (plan.stats.rebuild) {
		deps.logger.info(
			'收藏夹内容无变化，但同步模式与本地状态不一致，按所选模式重建',
		)
	}

	const details = await fetchFavoriteTrackDetails(deps, favoriteId, plan)
	if (details.isErr()) {
		return err(details.error)
	}
	if (details.value.hiddenBvids.length > 0) {
		deps.onHiddenVideos?.(details.value.hiddenBvids)
	}

	const expansion = await buildExpandedTracks(
		deps,
		local.value,
		details.value,
		expandMultiPage,
	)
	if (expansion.isErr()) {
		return err(expansion.error)
	}

	deps.onProgress?.({
		message: '正在保存数据到数据库...',
		stage: 'saving',
	})
	const persisted = await persistFavoriteSync(deps, {
		favoriteId,
		metadata: remote.value.metadata,
		details: details.value,
		expansion: expansion.value,
	})
	if (persisted.isErr()) {
		return err(persisted.error)
	}
	return ok(persisted.value)
}
