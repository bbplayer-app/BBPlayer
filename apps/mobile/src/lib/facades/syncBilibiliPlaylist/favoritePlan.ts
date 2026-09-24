import { err, ok, Result } from 'neverthrow'

import type { ServiceError } from '@/lib/errors'
import { createFacadeError, type FacadeError } from '@/lib/errors/facade'
import generateUniqueTrackKey from '@/lib/services/genKey'
import type {
	BilibiliFavoriteListContent,
	BilibiliMultipageVideo,
} from '@/types/apis/bilibili'
import type { BilibiliTrack } from '@/types/core/media'
import type { CreateTrackPayload } from '@/types/services/track'
import { diffSets } from '@/utils/set'

import type {
	ExpandedTrackData,
	FavoriteMainInfo,
	FavoriteSyncPlan,
	LocalFavoriteState,
	RemoteFavoriteSnapshot,
} from './types'

/**
 * 判断本地收藏夹是否处于「空」状态。
 * 与原实现一致：本地不存在收藏夹，或收藏夹元数据 itemCount 为 0 时视为空；
 * 本地存在但 tracks 为空（脏数据）同样按全量新增处理。
 */
function isEmptyLocalFavorite(local: LocalFavoriteState): boolean {
	return local.playlistId === null || local.tracks.length === 0
}

/**
 * 计算收藏夹同步计划（纯函数）。
 * - 远端与本地一致且展开模式一致：noop，直接早退
 * - 远端与本地一致但展开模式不一致：rebuild，按所选模式重建全部 track
 * - 否则：增量同步，仅补拉新增 bvid 的详情
 */
export function planFavoriteSync(
	remote: RemoteFavoriteSnapshot,
	local: LocalFavoriteState,
	expandMultiPage: boolean,
): FavoriteSyncPlan {
	let bvidsToAdd: Set<string>
	let bvidsToRemove: Set<string>

	if (isEmptyLocalFavorite(local)) {
		// 本地收藏夹为空或没创建过，则全部添加
		bvidsToAdd = new Set(remote.orderedBvids)
		bvidsToRemove = new Set()
	} else {
		const diff = diffSets(
			remote.orderedBvids,
			new Set(local.tracks.map((t) => t.bilibiliMetadata.bvid)),
		)
		// 注意，这里是相反的
		bvidsToAdd = diff.removed
		bvidsToRemove = diff.added
	}

	let stats = {
		added: bvidsToAdd.size,
		removed: bvidsToRemove.size,
		rebuild: false,
	}

	if (bvidsToAdd.size === 0 && bvidsToRemove.size === 0) {
		const localIsExpanded = local.tracks.some(
			(t) => t.bilibiliMetadata.isMultiPage,
		)
		if (localIsExpanded === expandMultiPage) {
			return {
				kind: 'noop',
				playlistId: local.playlistId ?? undefined,
				stats,
			}
		}
		// 收藏夹内容无变化，但所选同步模式与本地状态不一致（切换了展开/折叠），按所选模式重建
		// uniqueKey 依赖 isMultiPage，重建必须按所选模式重新生成所有 track，因此把全部 bvid 视为新增
		bvidsToAdd = new Set(remote.orderedBvids)
		stats = {
			added: bvidsToAdd.size,
			removed: bvidsToRemove.size,
			rebuild: true,
		}
	}

	return {
		kind: 'sync',
		orderedBvids: new Set(remote.orderedBvids),
		bvidsNeedingDetails: bvidsToAdd,
		stats,
	}
}

/** 按 bvid 对本地已有 tracks 分组 */
export function buildLocalGrouped(
	tracks: BilibiliTrack[],
): Map<string, BilibiliTrack[]> {
	const localGrouped = new Map<string, BilibiliTrack[]>()
	for (const track of tracks) {
		const list = localGrouped.get(track.bilibiliMetadata.bvid) ?? []
		list.push(track)
		localGrouped.set(track.bilibiliMetadata.bvid, list)
	}
	return localGrouped
}

/**
 * 构建「主视频信息」表：
 * 优先用新增视频的详情，其次回退到本地已有 track
 */
export function buildMainInfoMap(
	addedTracksMetadata: Set<BilibiliFavoriteListContent>,
	localGrouped: Map<string, BilibiliTrack[]>,
): Map<string, FavoriteMainInfo> {
	const mainInfoMap = new Map<string, FavoriteMainInfo>()
	for (const item of addedTracksMetadata) {
		mainInfoMap.set(item.bvid, {
			title: item.title,
			coverUrl: item.cover,
			duration: item.duration,
			videoIsValid: item.attr === 0,
			pageCount: item.page,
			upperMid: item.upper.mid,
		})
	}
	for (const [bvid, local] of localGrouped) {
		if (mainInfoMap.has(bvid)) continue
		const first = local[0]
		mainInfoMap.set(bvid, {
			title: first.title,
			coverUrl: first.coverUrl,
			duration: first.duration,
			videoIsValid: first.bilibiliMetadata.videoIsValid,
			artistId: first.artist?.id,
		})
	}
	return mainInfoMap
}

/**
 * 选出需要请求分 P 列表的 bvid：
 * - 本地已展开的直接复用，不发请求
 * - 失效视频无法获取分 P 信息，折叠为单条兜底
 * - 收藏夹接口已带分 P 数量，单 P 视频无需查询
 */
export function selectBvidsToQuery(
	allBvids: string[],
	localGrouped: Map<string, BilibiliTrack[]>,
	mainInfoMap: Map<string, FavoriteMainInfo>,
): string[] {
	return allBvids.filter((bvid) => {
		const local = localGrouped.get(bvid)
		if (local?.some((t) => t.bilibiliMetadata.isMultiPage)) {
			return false
		}
		const info = mainInfoMap.get(bvid)
		if (info && !info.videoIsValid) return false
		if (info && info.pageCount !== undefined && info.pageCount <= 1) {
			return false
		}
		return true
	})
}

/**
 * 将分 P 列表展开为 track 数据；单 P 视频折叠为单条（isMultiPage: false）
 */
export function expandFromPages(
	bvid: string,
	pages: BilibiliMultipageVideo[],
	mainInfo: Omit<FavoriteMainInfo, 'pageCount'>,
): ExpandedTrackData[] {
	if (pages.length <= 1) {
		return [
			{
				bvid,
				title: mainInfo.title,
				duration: mainInfo.duration,
				cid: null,
				isMultiPage: false,
				videoIsValid: mainInfo.videoIsValid,
				coverUrl: mainInfo.coverUrl,
				artistId: mainInfo.artistId,
				upperMid: mainInfo.upperMid,
			},
		]
	}
	return pages.map((p) => ({
		bvid,
		title: p.part,
		duration: p.duration,
		cid: p.cid,
		isMultiPage: true,
		mainTrackTitle: mainInfo.title,
		videoIsValid: mainInfo.videoIsValid,
		coverUrl: mainInfo.coverUrl,
		artistId: mainInfo.artistId,
		upperMid: mainInfo.upperMid,
	}))
}

/**
 * 为收藏夹内所有 bvid 构建展开后的 track 数据。
 * 本地已展开的直接复用，其余用分 P 列表展开。
 */
export function buildExpandedTracksMap(
	allBvids: string[],
	localGrouped: Map<string, BilibiliTrack[]>,
	mainInfoMap: Map<string, FavoriteMainInfo>,
	pageLists: Map<string, BilibiliMultipageVideo[]>,
): Result<Map<string, ExpandedTrackData[]>, FacadeError> {
	const expandedTracksMap = new Map<string, ExpandedTrackData[]>()
	for (const bvid of allBvids) {
		const local = localGrouped.get(bvid)
		if (local?.some((t) => t.bilibiliMetadata.isMultiPage)) {
			expandedTracksMap.set(
				bvid,
				local.map((t) => ({
					bvid,
					title: t.title,
					duration: t.duration,
					cid: t.bilibiliMetadata.cid,
					isMultiPage: true,
					mainTrackTitle: t.bilibiliMetadata.mainTrackTitle,
					videoIsValid: t.bilibiliMetadata.videoIsValid,
					coverUrl: t.coverUrl,
					artistId: t.artist?.id,
				})),
			)
			continue
		}
		const info = mainInfoMap.get(bvid)
		if (!info) {
			return err(
				createFacadeError(
					'SyncFavoriteFailed',
					'展开分 P 失败：缺少视频元数据',
				),
			)
		}
		expandedTracksMap.set(
			bvid,
			expandFromPages(bvid, pageLists.get(bvid) ?? [], info),
		)
	}
	return ok(expandedTracksMap)
}

/**
 * 根据展开结果或新增详情构建 track payloads。
 * 展开时必须包含所有条目（包括此前以折叠态存在的 bvid），否则其新的 `bvid::cid`
 * key 会被用于排序却从未被创建。
 */
export function buildFavoriteTrackPayloads(
	addedTracksMetadata: Set<BilibiliFavoriteListContent>,
	expandedTracksMap: Map<string, ExpandedTrackData[]> | null,
	artistsMap: ReadonlyMap<string, { id: number }>,
): CreateTrackPayload[] {
	if (expandedTracksMap) {
		return Array.from(expandedTracksMap.entries()).flatMap(([, tracks]) =>
			tracks.map((t) => ({
				title: t.title,
				source: 'bilibili' as const,
				bilibiliMetadata: {
					bvid: t.bvid,
					isMultiPage: t.isMultiPage,
					cid: t.cid ?? null,
					mainTrackTitle: t.mainTrackTitle,
					videoIsValid: t.videoIsValid,
				},
				coverUrl: t.coverUrl,
				duration: t.duration,
				artistId: t.artistId ?? artistsMap.get(String(t.upperMid))?.id,
			})),
		)
	}
	return Array.from(addedTracksMetadata).map((v) => ({
		title: v.title,
		source: 'bilibili' as const,
		bilibiliMetadata: {
			bvid: v.bvid,
			isMultiPage: false,
			cid: null,
			videoIsValid: v.attr === 0,
		},
		coverUrl: v.cover,
		duration: v.duration,
		artistId: artistsMap.get(String(v.upper.mid))?.id,
	}))
}

/**
 * 按收藏夹顺序（已剔除隐藏视频）生成最终用于排序的 uniqueKey 列表。
 * 使用清洗过后的 orderedBvids，而非原始远端列表。
 */
export function buildFavoriteOrderedUniqueKeys(
	orderedBvids: Set<string>,
	expandedTracksMap: Map<string, ExpandedTrackData[]> | null,
): Result<string[], ServiceError> {
	if (expandedTracksMap) {
		return Result.combine(
			Array.from(orderedBvids).flatMap((bvid) =>
				(expandedTracksMap.get(bvid) ?? []).map((t) =>
					generateUniqueTrackKey({
						source: 'bilibili',
						bilibiliMetadata: {
							bvid: t.bvid,
							isMultiPage: t.isMultiPage,
							cid: t.cid ?? undefined,
							videoIsValid: true,
						},
					}),
				),
			),
		)
	}
	return Result.combine(
		Array.from(orderedBvids).map((bvid) =>
			generateUniqueTrackKey({
				source: 'bilibili',
				bilibiliMetadata: {
					bvid: bvid,
					isMultiPage: false,
					videoIsValid: true,
				},
			}),
		),
	)
}
