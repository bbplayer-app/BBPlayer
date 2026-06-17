/**
 * 阶段一：API 防腐层（Anti-Corruption Layer）
 *
 * 职责：
 * - 抹平 Bilibili 收藏集 / 装扮 API 的差异（N+1 请求、不同的响应结构）
 * - 统一产出经过 arktype 校验的 SkinAssetDeclaration
 * - 不关心下载、本地路径、UI 渲染 —— 只做「API → Schema」的纯映射
 */
import { bilibiliApi } from '@/lib/api/bilibili/api'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import type {
	BilibiliGarbAssetBagItem,
	BilibiliGarbCollectEntry,
	BilibiliGarbThemeSkinProperties,
} from '@/types/apis/bilibili'
import type {
	BilibiliGarbAvatarFrameProperties,
	BilibiliGarbBenefitResponse,
	BilibiliGarbLoadingProperties,
	BilibiliGarbPlayIconProperties,
	BilibiliGarbSuitCardBgProperties,
	BilibiliGarbSuitCardProperties,
	BilibiliGarbSuitSpaceBgProperties,
	BilibiliGarbThumbUpProperties,
} from '@/types/apis/garb'
import log from '@/utils/log'

import { parseSkinAssetDeclaration, type SkinAssetDeclaration } from './schema'

// ============================================================
// 卡牌解析：API raw → SkinCardAsset
// ============================================================

/** 收藏集资产包的抽卡 */
const parseCardItem = (
	card: NonNullable<BilibiliGarbAssetBagItem['card_item']>,
	index: number,
): SkinAssetDeclaration['cards'][number] => ({
	img: card.card_img ?? '',
	name: card.card_name ?? `卡牌 ${index + 1}`,
	type_id: card.card_type_id ?? `card_${index + 1}`,
	video_list: card.video_list?.length ? card.video_list : null,
})

/** 收藏集抽满奖励中的卡牌 */
const parseCollectCardItem = (
	card: NonNullable<
		NonNullable<BilibiliGarbCollectEntry['card_item']>['card_asset_info']
	>['card_item'],
	index: number,
): SkinAssetDeclaration['cards'][number] => ({
	img: card?.card_img ?? '',
	name: card?.card_name ?? `卡牌 ${index + 1}`,
	type_id: card?.card_type_id ?? `card_${index + 1}`,
	video_list: card?.video_list?.length ? card.video_list : null,
})

// ============================================================
// 组件解析：单个 benefit → schema 素材
// ============================================================

interface ResolvedComponent {
	data: unknown
	partId: number | null
}

/** 收藏集奖励里的组件需要逐个请求 benefit API */
const resolveComponent = async (
	componentId: string,
	componentName: string | null,
	signal?: AbortSignal,
): Promise<ResolvedComponent> => {
	const result = await bilibiliApi.fetchGarbBenefit({
		itemId: componentId,
		signal,
	})
	if (result.isErr()) {
		log.warning('[adapter] failed to resolve component', {
			componentId,
			componentName,
			error: result.error.message,
		})
		throw result.error
	}
	const data: BilibiliGarbBenefitResponse = result.value
	const id = Number(componentId) || 0

	switch (data.part_id) {
		case 1: {
			const props: BilibiliGarbAvatarFrameProperties = data.properties ?? {}
			return {
				data: {
					id,
					image: props.image ?? null,
					name: componentName,
				},
				partId: 1,
			}
		}
		case 3: {
			const props: BilibiliGarbThumbUpProperties = data.properties ?? {}
			return {
				data: {
					ani_cut: props.image_ani_cut ?? null,
					ani_file: props.image_ani ?? null,
					id,
					name: componentName,
					preview: props.image_preview ?? null,
				},
				partId: 3,
			}
		}
		case 9: {
			const props: BilibiliGarbThemeSkinProperties = data.properties ?? {}
			return {
				data: {
					color: props.color ?? null,
					color_mode: props.color_mode ?? null,
					color_second_page: props.color_second_page ?? null,
					head_bg: props.head_bg ?? null,
					head_myself_bg: props.head_myself_bg ?? null,
					head_myself_mp4_bg: props.head_myself_mp4_bg ?? null,
					head_myself_squared_bg: props.head_myself_squared_bg ?? null,
					head_tab_bg: props.head_tab_bg ?? null,
					id,
					image_cover: props.image_cover ?? null,
					image_preview: props.image_preview ?? null,
					name: componentName,
					package_md5: props.package_md5 ?? null,
					package_url: props.package_url ?? null,
					side_bg: props.side_bg ?? null,
					side_bg_bottom: props.side_bg_bottom ?? null,
					tail_bg: props.tail_bg ?? null,
					tail_color: props.tail_color ?? null,
					tail_color_selected: props.tail_color_selected ?? null,
					tail_icon_ani: props.tail_icon_ani ?? null,
					tail_icon_channel: props.tail_icon_channel ?? null,
					tail_icon_dynamic: props.tail_icon_dynamic ?? null,
					tail_icon_main: props.tail_icon_main ?? null,
					tail_icon_myself: props.tail_icon_myself ?? null,
					tail_icon_pub_btn_bg: props.tail_icon_pub_btn_bg ?? null,
					tail_icon_selected_channel: props.tail_icon_selected_channel ?? null,
					tail_icon_selected_dynamic: props.tail_icon_selected_dynamic ?? null,
					tail_icon_selected_main: props.tail_icon_selected_main ?? null,
					tail_icon_selected_myself: props.tail_icon_selected_myself ?? null,
					tail_icon_selected_pub_btn_bg:
						props.tail_icon_selected_pub_btn_bg ?? null,
					tail_icon_selected_shop: props.tail_icon_selected_shop ?? null,
					tail_icon_shop: props.tail_icon_shop ?? null,
				},
				partId: 9,
			}
		}
		case 10: {
			const props: BilibiliGarbLoadingProperties = data.properties ?? {}
			return {
				data: {
					id,
					loading_frame_url: props.loading_frame_url ?? null,
					loading_url: props.loading_url ?? null,
					name: componentName,
					preview: props.image_preview_small ?? null,
				},
				partId: 10,
			}
		}
		case 11: {
			const props: BilibiliGarbPlayIconProperties = data.properties ?? {}
			return {
				data: {
					drag_left_png: props.drag_left_png ?? null,
					drag_right_png: props.drag_right_png ?? null,
					id,
					middle_png: props.middle_png ?? null,
					name: componentName,
					squared_image: props.squared_image ?? null,
					static_icon_image: props.static_icon_image ?? null,
				},
				partId: 11,
			}
		}
		default:
			return { data: null, partId: null }
	}
}

// ============================================================
// 奖励解析 & 组装
// ============================================================

const appendComponent = (
	table: SkinAssetDeclaration,
	partId: number | null,
	data: unknown,
) => {
	if (!data) return
	switch (partId) {
		case 1:
			table.avatar_frames.push(
				data as SkinAssetDeclaration['avatar_frames'][number],
			)
			break
		case 3:
			table.thumbups.push(data as SkinAssetDeclaration['thumbups'][number])
			break
		case 9:
			table.skins.push(data as SkinAssetDeclaration['skins'][number])
			break
		case 10:
			table.loadings.push(data as SkinAssetDeclaration['loadings'][number])
			break
		case 11:
			table.play_icons.push(data as SkinAssetDeclaration['play_icons'][number])
			break
	}
}

const parseReward = async (
	table: SkinAssetDeclaration,
	entry: BilibiliGarbCollectEntry,
	index: number,
	signal?: AbortSignal,
) => {
	const itemType = entry.redeem_item_type
	const itemId = entry.redeem_item_id
	const itemName = entry.redeem_item_name

	// type=1: 卡牌奖励
	if (itemType === 1) {
		const card = entry.card_item?.card_asset_info?.card_item
		if (card) {
			table.cards.push(parseCollectCardItem(card, table.cards.length + index))
		}
		return
	}

	// type=2/3/5: 组件奖励（需逐个请求 benefit API）
	if (itemType !== 2 && itemType !== 3 && itemType !== 5) return
	if (!itemId) return

	const componentIds = itemId
		.split('&')
		.map((id) => id.trim())
		.filter(Boolean)
	const bundled = componentIds.length > 1

	for (const componentId of componentIds) {
		const component = await resolveComponent(
			componentId,
			bundled ? null : itemName,
			signal,
		)
		appendComponent(table, component.partId, component.data)
	}
}

// ============================================================
// 空表格工厂
// ============================================================

const emptyAssetDeclaration = (
	base:
		| {
				act_id: number
				lottery_id: number
				name: string
				type: 'collection'
		  }
		| {
				item_id: number
				name: string
				type: 'suit'
		  },
): SkinAssetDeclaration => ({
	...base,
	avatar_frames: [],
	card_backgrounds: [],
	cards: [],
	coverUri: null,
	loadings: [],
	play_icons: [],
	skins: [],
	space_backgrounds: [],
	thumbups: [],
})

// ============================================================
// 主构建器
// ============================================================

const buildCollectionAssetDeclaration = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
): Promise<SkinAssetDeclaration> => {
	if (!item.actId || !item.lotteryId) {
		throw new Error('收藏集搜索结果缺少 act_id 或 lottery_id')
	}

	const result = await bilibiliApi.fetchGarbAssetBag({
		actId: item.actId,
		lotteryId: item.lotteryId,
		signal,
	})
	if (result.isErr()) {
		log.error('[adapter] fetchGarbAssetBag failed', {
			actId: item.actId,
			error: result.error.message,
		})
		throw result.error
	}

	const data = result.value
	const table = emptyAssetDeclaration({
		act_id: item.actId,
		lottery_id: item.lotteryId,
		name: item.name,
		type: 'collection',
	})
	table.coverUri = item.coverUri

	// 资产包卡牌
	data.item_list?.forEach((entry, index) => {
		if (entry.card_item) {
			table.cards.push(parseCardItem(entry.card_item, index))
		}
	})

	// 奖励（含 N+1 子请求）
	let rewardIndex = 0
	for (const entry of data.collect_list ?? []) {
		await parseReward(table, entry, rewardIndex, signal)
		rewardIndex += 1
	}

	return parseSkinAssetDeclaration(table)
}

const buildSuitAssetDeclaration = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
): Promise<SkinAssetDeclaration> => {
	if (!item.itemId) {
		throw new Error('主题装扮搜索结果缺少 item_id')
	}

	const result = await bilibiliApi.fetchGarbSuitDetail({
		itemId: item.itemId,
		signal,
	})
	if (result.isErr()) {
		log.error('[adapter] fetchGarbSuitDetail failed', {
			error: result.error.message,
			itemId: item.itemId,
		})
		throw result.error
	}

	const suitItems = result.value.suit_items
	const table = emptyAssetDeclaration({
		item_id: item.itemId,
		name: item.name,
		type: 'suit',
	})
	table.coverUri = item.coverUri
	let nextCardId = 1

	// 头像框
	for (const entry of suitItems.card ?? []) {
		const props: BilibiliGarbSuitCardProperties = entry.properties ?? {}
		table.avatar_frames.push({
			id: entry.item_id,
			image: props.image ?? null,
			name: entry.name,
		})
	}

	// 卡牌背景
	for (const entry of suitItems.card_bg ?? []) {
		const props: BilibiliGarbSuitCardBgProperties = entry.properties ?? {}
		table.card_backgrounds.push({
			id: entry.item_id,
			image: props.image ?? null,
			name: entry.name || item.name,
			preview: props.image_preview_small ?? null,
		})
	}

	// 空间背景（同时生成启动卡牌）
	for (const entry of suitItems.space_bg ?? []) {
		const props: BilibiliGarbSuitSpaceBgProperties = entry.properties ?? {}
		const images: { landscape: string | null; portrait: string | null }[] = []

		for (let idx = 1; idx <= 8; idx += 1) {
			const landscape = props[`image${idx}_landscape`]?.trim() || null
			const portrait = props[`image${idx}_portrait`]?.trim() || null
			if (!landscape && !portrait) continue

			images.push({ landscape, portrait })
			if (portrait) {
				table.cards.push({
					img: portrait,
					name: String(nextCardId),
					type_id: `auto_${nextCardId}`,
					video_list: null,
				})
				nextCardId += 1
			}
		}

		table.space_backgrounds.push({
			id: entry.item_id,
			images,
			name: entry.name || item.name,
		})
	}

	// 点赞动效
	for (const entry of suitItems.thumbup ?? []) {
		const props: BilibiliGarbThumbUpProperties = entry.properties ?? {}
		table.thumbups.push({
			ani_cut: props.image_ani_cut ?? null,
			ani_file: props.image_ani ?? null,
			id: entry.item_id,
			name: entry.name,
			preview: props.image_preview ?? null,
		})
	}

	// 主题皮肤
	for (const entry of suitItems.skin ?? []) {
		const props: BilibiliGarbThemeSkinProperties = entry.properties ?? {}
		table.skins.push({
			color: props.color ?? null,
			color_mode: props.color_mode ?? null,
			color_second_page: props.color_second_page ?? null,
			head_bg: props.head_bg ?? null,
			head_myself_bg: props.head_myself_bg ?? null,
			head_myself_mp4_bg: props.head_myself_mp4_bg ?? null,
			head_myself_squared_bg: props.head_myself_squared_bg ?? null,
			head_tab_bg: props.head_tab_bg ?? null,
			id: entry.item_id,
			image_cover: props.image_cover ?? null,
			image_preview: props.image_preview ?? null,
			name: entry.name,
			package_md5: props.package_md5 ?? null,
			package_url: props.package_url ?? null,
			side_bg: props.side_bg ?? null,
			side_bg_bottom: props.side_bg_bottom ?? null,
			tail_bg: props.tail_bg ?? null,
			tail_color: props.tail_color ?? null,
			tail_color_selected: props.tail_color_selected ?? null,
			tail_icon_ani: props.tail_icon_ani ?? null,
			tail_icon_channel: props.tail_icon_channel ?? null,
			tail_icon_dynamic: props.tail_icon_dynamic ?? null,
			tail_icon_main: props.tail_icon_main ?? null,
			tail_icon_myself: props.tail_icon_myself ?? null,
			tail_icon_pub_btn_bg: props.tail_icon_pub_btn_bg ?? null,
			tail_icon_selected_channel: props.tail_icon_selected_channel ?? null,
			tail_icon_selected_dynamic: props.tail_icon_selected_dynamic ?? null,
			tail_icon_selected_main: props.tail_icon_selected_main ?? null,
			tail_icon_selected_myself: props.tail_icon_selected_myself ?? null,
			tail_icon_selected_pub_btn_bg:
				props.tail_icon_selected_pub_btn_bg ?? null,
			tail_icon_selected_shop: props.tail_icon_selected_shop ?? null,
			tail_icon_shop: props.tail_icon_shop ?? null,
		})
	}

	// 加载动画
	for (const entry of suitItems.loading ?? []) {
		const props: BilibiliGarbLoadingProperties = entry.properties ?? {}
		table.loadings.push({
			id: entry.item_id,
			loading_frame_url: props.loading_frame_url ?? null,
			loading_url: props.loading_url ?? null,
			name: entry.name,
			preview: props.image_preview_small ?? null,
		})
	}

	// 播放图标
	for (const entry of suitItems.play_icon ?? []) {
		const props: BilibiliGarbPlayIconProperties = entry.properties ?? {}
		table.play_icons.push({
			drag_left_png: props.drag_left_png ?? null,
			drag_right_png: props.drag_right_png ?? null,
			id: entry.item_id,
			middle_png: props.middle_png ?? null,
			name: entry.name,
			squared_image: props.squared_image ?? null,
			static_icon_image: props.static_icon_image ?? null,
		})
	}

	return parseSkinAssetDeclaration(table)
}

// ============================================================
// 公开入口
// ============================================================

/**
 * 根据搜索结果获取统一的资产声明。
 * 内部根据 kind 分发到收藏集 / 装扮构建器，统一返回经过 arktype 校验的 SkinAssetDeclaration。
 */
export const fetchGarbSkinAssetDeclaration = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
): Promise<SkinAssetDeclaration> => {
	switch (item.kind) {
		case 'collection': {
			log.debug('[adapter] building collection asset declaration', {
				actId: item.actId,
				lotteryId: item.lotteryId,
				name: item.name,
			})
			const result = await buildCollectionAssetDeclaration(item, signal)
			log.debug('[adapter] collection declaration built', {
				cards: result.cards.length,
				skins: result.skins.length,
				thumbups: result.thumbups.length,
			})
			return result
		}
		case 'suit': {
			log.debug('[adapter] building suit asset declaration', {
				itemId: item.itemId,
				name: item.name,
			})
			const result = await buildSuitAssetDeclaration(item, signal)
			log.debug('[adapter] suit declaration built', {
				cards: result.cards.length,
				skins: result.skins.length,
				thumbups: result.thumbups.length,
			})
			return result
		}
		default:
			throw new Error('当前只支持下载收藏集和主题装扮')
	}
}
