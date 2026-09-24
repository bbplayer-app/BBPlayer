import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

import type { bilibiliApi as BilibiliApiService } from '@/lib/api/bilibili/api'
import type * as schema from '@/lib/db/schema'
import type { ArtistService } from '@/lib/services/artistService'
import type { PlaylistService } from '@/lib/services/playlistService'
import type { TrackService } from '@/lib/services/trackService'
import type {
	BilibiliFavoriteListContent,
	BilibiliFavoriteListContents,
} from '@/types/apis/bilibili'
import type { BilibiliTrack } from '@/types/core/media'

export interface PlaylistSyncProgress {
	message: string
	current?: number
	total?: number
	stage:
		| 'initializing'
		| 'fetching_metadata'
		| 'calculating_diff'
		| 'fetching_details'
		| 'saving'
		| 'completed'
		| 'error'
}

export type ProgressFn = (progress: PlaylistSyncProgress) => void

/** 展开分 P 后的单条 track 数据 */
export interface ExpandedTrackData {
	bvid: string
	title: string
	duration: number
	cid: number | null
	isMultiPage: boolean
	mainTrackTitle?: string | null
	videoIsValid: boolean
	coverUrl: string | null
	artistId?: number
	upperMid?: number
}

/** 结构化的日志接口，便于阶段函数与真实 logger 解耦、也便于测试 */
export interface SyncLogger {
	debug: (...args: unknown[]) => void
	info: (...args: unknown[]) => void
	warning: (...args: unknown[]) => void
	error: (...args: unknown[]) => void
}

export type FavoriteListInfo = NonNullable<BilibiliFavoriteListContents['info']>

/** 阶段 1 产物：远端快照 */
export interface RemoteFavoriteSnapshot {
	metadata: FavoriteListInfo
	/** 远端完整 bvid 顺序（已过滤非视频稿件） */
	orderedBvids: Set<string>
}

/** 阶段 2 产物：本地快照 */
export interface LocalFavoriteState {
	playlistId: number | null
	/** 不存在或 itemCount===0 时为 [] */
	tracks: BilibiliTrack[]
}

export interface FavoriteSyncStats {
	added: number
	removed: number
	rebuild: boolean
}

/** 阶段 3 产物：同步计划（把「早退」显式化为 noop） */
export type FavoriteSyncPlan =
	| { kind: 'noop'; playlistId: number | undefined; stats: FavoriteSyncStats }
	| {
			kind: 'sync'
			/** 最终排序依据，阶段 4 会剔除被隐藏的 bvid */
			orderedBvids: Set<string>
			/** 需要补详情/分 P 的 bvid（增量=新增；rebuild=全部） */
			bvidsNeedingDetails: Set<string>
			stats: FavoriteSyncStats
	  }

/** 阶段 4 产物：新增视频详情 + 清理后的顺序 */
export interface FavoriteTrackDetails {
	metadata: Set<BilibiliFavoriteListContent>
	/** 已剔除被 up 隐藏的 bvid 之后的完整顺序 */
	orderedBvids: Set<string>
	/** 远端索引里存在、但详情接口查不到的隐藏稿件 */
	hiddenBvids: string[]
}

/** 阶段 5 产物：展开分 P 结果 */
export interface FavoriteExpansion {
	/** 未开启展开时为 null */
	expandedTracksMap: Map<string, ExpandedTrackData[]> | null
}

/** 展开分 P 时用于构建 track 的主视频信息 */
export interface FavoriteMainInfo {
	title: string
	coverUrl: string | null
	duration: number
	videoIsValid: boolean
	pageCount?: number
	artistId?: number
	upperMid?: number
}

/** 收藏夹同步只依赖 bilibili api 的这三个方法 */
export type FavoriteRemoteApi = Pick<
	typeof BilibiliApiService,
	'getFavoriteListAllContents' | 'getFavoriteListContents' | 'getPageList'
>

/** 收藏夹同步各阶段函数共享的依赖集合 */
export interface FavoriteSyncDeps {
	api: FavoriteRemoteApi
	playlistService: PlaylistService
	trackService: TrackService
	artistService: ArtistService
	db: ExpoSQLiteDatabase<typeof schema>
	logger: SyncLogger
	onProgress?: ProgressFn
	/** 远端索引里存在、但详情接口查不到的隐藏稿件 */
	onHiddenVideos?: (bvids: string[]) => void
	onSynced?: (trackCount: number) => void
}
