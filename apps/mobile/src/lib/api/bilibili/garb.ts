/**
 * Bilibili 装扮/收藏集相关类型
 *
 * 适配逻辑已迁移至 @/services/theme/adapter.ts，
 * 此处仅保留搜索结果的共享类型。
 */

export type GarbSkinKind = 'collection' | 'suit'

export interface GarbSkinSearchResult {
	actId: number | null
	coverUri: string | null
	itemId: number | null
	kind: GarbSkinKind | null
	lotteryId: number | null
	name: string
	partId: number | null
}
