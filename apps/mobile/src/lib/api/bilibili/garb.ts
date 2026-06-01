/**
 * 从这个文件可以看出你 b 的装扮/收藏集相关 api 有多复杂。。。
 * 并且每个装扮/收藏集含有的资产可能都不相同，所以我们内部构建了一个统一的资产清单，尽可能去抹平这些差异
 */
import {
	parseSkinAssetDeclaration,
	type SkinAssetDeclaration,
} from '@/lib/theme/skins'
import type {
	BilibiliGarbAssetBagItem,
	BilibiliGarbAssetBagResponse,
	BilibiliGarbCollectEntry,
} from '@/types/apis/bilibili'

import { bilibiliApi } from './api'

// ============================================================
// 搜索相关类型（项目内使用，非 API raw 类型）
// ============================================================

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

// ============================================================
// 工具函数
// ============================================================

const defaultString = <T extends string>(value: unknown, fallback: T): T =>
	typeof value === 'string' && value.trim().length > 0
		? (value.trim() as T)
		: fallback

const nullableString = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null

// ============================================================
// 卡牌解析：API raw → SkinCardAsset
// ============================================================

/**
 * 收藏集的抽卡
 */
const parseCardItem = (
	card: NonNullable<BilibiliGarbAssetBagItem['card_item']>,
	index: number,
): SkinAssetDeclaration['cards'][number] => ({
	img: card.card_img ?? '',
	name: card.card_name ?? `卡牌 ${index + 1}`,
	type_id: card.card_type_id ?? `card_${index + 1}`,
	video_list: card.video_list?.length ? card.video_list : null,
})

/**
 * 部分收藏集抽满固定抽数会有这些额外的卡牌奖励，咱们把它转换为我们的数据结构
 */
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
// 组件解析：API raw → 组件
// ============================================================

// TODO: 这里后续需要更改，把所有 part_id 所对应的返回内容全部声明为强类型
/**
 * 获取并解析收藏集的额外奖励
 */
const resolveComponent = async (
	componentId: string,
	componentName: string | null,
	signal?: AbortSignal,
) => {
	const result = await bilibiliApi.fetchGarbBenefit({
		itemId: componentId,
		signal,
	})
	if (result.isErr()) throw result.error

	const data = result.value
	const partId = data.part_id ?? null
	const id = Number(componentId) || 0
	const suitItems = data.suit_items

	switch (partId) {
		case 1: {
			const props =
				suitItems?.emoji_package?.[0]?.properties ?? data.properties ?? {}
			return {
				data: {
					id,
					image: nullableString(props.image),
					name: componentName,
				},
				partId,
			}
		}
		case 3: {
			const props =
				suitItems?.emoji_package?.[0]?.properties ?? data.properties ?? {}
			return {
				data: {
					ani_cut: nullableString(props.image_ani_cut),
					ani_file: nullableString(props.image_ani),
					id,
					name: componentName,
					preview: nullableString(props.image_preview),
				},
				partId,
			}
		}
		case 5: {
			const topProps = data.properties ?? {}
			const packageItem = suitItems?.emoji_package?.[0]
			const packageProps = packageItem?.properties ?? {}

			const fromJson = (() => {
				const raw = topProps.item_emoji_list ?? packageProps.item_emoji_list
				if (typeof raw !== 'string' || !raw) return []
				try {
					return (JSON.parse(raw) as Record<string, unknown>[]).map((item) => ({
						image_gif: nullableString(item.image_gif as string | undefined),
						image_static: nullableString(item.image as string | undefined),
						image_webp: nullableString(item.image_webp as string | undefined),
						name: defaultString(item.name as string | undefined, '表情'),
					}))
				} catch {
					return []
				}
			})()

			const fromItems = [
				...(suitItems?.emoji ?? []).map((item) => ({
					image_gif: nullableString(item.properties?.image_gif),
					image_static: nullableString(item.properties?.image),
					image_webp: nullableString(item.properties?.image_webp),
					name: item.name || '表情',
				})),
				...(packageItem?.items ?? []).map((item) => ({
					image_gif: nullableString(item.properties?.image_gif),
					image_static: nullableString(item.properties?.image),
					image_webp: nullableString(item.properties?.image_webp),
					name: item.name || '表情',
				})),
			]

			return {
				data: {
					emojis: [...fromJson, ...fromItems],
					id,
					name: componentName,
				},
				partId,
			}
		}
		case 9: {
			const props =
				suitItems?.emoji_package?.[0]?.properties ?? data.properties ?? {}
			return {
				data: {
					color: nullableString(props.color),
					color_mode: nullableString(props.color_mode),
					color_second_page: nullableString(props.color_second_page),
					head_bg: nullableString(props.head_bg),
					head_myself_bg: nullableString(props.head_myself_bg),
					head_myself_mp4_bg: nullableString(props.head_myself_mp4_bg),
					head_myself_squared_bg: nullableString(props.head_myself_squared_bg),
					head_tab_bg: nullableString(props.head_tab_bg),
					id,
					image_cover: nullableString(props.image_cover),
					image_preview: nullableString(props.image_preview),
					name: componentName,
					package_md5: nullableString(props.package_md5),
					package_url: nullableString(props.package_url),
					side_bg: nullableString(props.side_bg),
					side_bg_bottom: nullableString(props.side_bg_bottom),
					tail_bg: nullableString(props.tail_bg),
					tail_color: nullableString(props.tail_color),
					tail_color_selected: nullableString(props.tail_color_selected),
					tail_icon_ani: nullableString(props.tail_icon_ani),
					tail_icon_channel: nullableString(props.tail_icon_channel),
					tail_icon_dynamic: nullableString(props.tail_icon_dynamic),
					tail_icon_main: nullableString(props.tail_icon_main),
					tail_icon_myself: nullableString(props.tail_icon_myself),
					tail_icon_pub_btn_bg: nullableString(props.tail_icon_pub_btn_bg),
					tail_icon_selected_channel: nullableString(
						props.tail_icon_selected_channel,
					),
					tail_icon_selected_dynamic: nullableString(
						props.tail_icon_selected_dynamic,
					),
					tail_icon_selected_main: nullableString(
						props.tail_icon_selected_main,
					),
					tail_icon_selected_myself: nullableString(
						props.tail_icon_selected_myself,
					),
					tail_icon_selected_pub_btn_bg: nullableString(
						props.tail_icon_selected_pub_btn_bg,
					),
					tail_icon_selected_shop: nullableString(
						props.tail_icon_selected_shop,
					),
					tail_icon_shop: nullableString(props.tail_icon_shop),
				},
				partId,
			}
		}
		case 10: {
			const props =
				suitItems?.emoji_package?.[0]?.properties ?? data.properties ?? {}
			return {
				data: {
					id,
					loading_frame_url: nullableString(props.loading_frame_url),
					loading_url: nullableString(props.loading_url),
					name: componentName,
					preview: nullableString(props.image_preview_small),
				},
				partId,
			}
		}
		case 11: {
			const props =
				suitItems?.emoji_package?.[0]?.properties ?? data.properties ?? {}
			return {
				data: {
					drag_left_png: nullableString(props.drag_left_png),
					drag_right_png: nullableString(props.drag_right_png),
					id,
					middle_png: nullableString(props.middle_png),
					name: componentName,
					squared_image: nullableString(props.squared_image),
					static_icon_image: nullableString(props.static_icon_image),
				},
				partId,
			}
		}
		default:
			return { data: null, partId: null }
	}
}

// ============================================================
// 奖励解析
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
		case 5:
			table.emoji_packages.push(
				data as SkinAssetDeclaration['emoji_packages'][number],
			)
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

	// type=2/3/5: 组件奖励
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
// 收藏集 / 装扮构建
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
	emoji_packages: [],
	loadings: [],
	play_icons: [],
	skins: [],
	space_backgrounds: [],
	thumbups: [],
})

const collectListEntries = (
	value: BilibiliGarbAssetBagResponse['collect_list'],
): BilibiliGarbCollectEntry[] => {
	if (Array.isArray(value)) return value
	if (!value) return []
	return [...(value.collect_infos ?? []), ...(value.collect_chain ?? [])]
}

const buildCollectionAssetDeclaration = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
) => {
	if (!item.actId || !item.lotteryId) {
		throw new Error('收藏集搜索结果缺少 act_id 或 lottery_id')
	}

	const result = await bilibiliApi.fetchGarbAssetBag({
		actId: item.actId,
		lotteryId: item.lotteryId,
		signal,
	})
	if (result.isErr()) throw result.error

	const data = result.value
	const table = emptyAssetDeclaration({
		act_id: item.actId,
		lottery_id: item.lotteryId,
		name: item.name,
		type: 'collection',
	})

	;(data.item_list ?? []).forEach((entry, index) => {
		if (entry.card_item) {
			table.cards.push(parseCardItem(entry.card_item, index))
		}
	})

	const rewards = collectListEntries(data.collect_list)
	for (const [index, entry] of rewards.entries()) {
		await parseReward(table, entry, index, signal)
	}

	return parseSkinAssetDeclaration(table)
}

const buildSuitAssetDeclaration = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
) => {
	if (!item.itemId) {
		throw new Error('主题装扮搜索结果缺少 item_id')
	}

	const result = await bilibiliApi.fetchGarbSuitDetail({
		itemId: item.itemId,
		signal,
	})
	if (result.isErr()) throw result.error

	const suitItems = result.value.suit_items
	const table = emptyAssetDeclaration({
		item_id: item.itemId,
		name: item.name,
		type: 'suit',
	})
	let nextCardId = 1

	for (const entry of suitItems.card ?? []) {
		table.avatar_frames.push({
			id: entry.item_id,
			image: nullableString(entry.properties?.image),
			name: entry.name,
		})
	}

	for (const entry of suitItems.card_bg ?? []) {
		table.card_backgrounds.push({
			id: entry.item_id,
			image: nullableString(entry.properties?.image),
			name: entry.name || item.name,
			preview: nullableString(entry.properties?.image_preview_small),
		})
	}

	for (const entry of suitItems.space_bg ?? []) {
		const props = entry.properties ?? {}
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

	for (const entry of suitItems.emoji_package ?? []) {
		const topProps = entry.properties ?? {}
		const fromJson = (() => {
			const raw = topProps.item_emoji_list
			if (typeof raw !== 'string' || !raw) return []
			try {
				return (JSON.parse(raw) as Record<string, unknown>[]).map((e) => ({
					image_gif: nullableString(e.image_gif as string | undefined),
					image_static: nullableString(e.image as string | undefined),
					image_webp: nullableString(e.image_webp as string | undefined),
					name: defaultString(e.name as string | undefined, '表情'),
				}))
			} catch {
				return []
			}
		})()

		const fromItems = (entry.items ?? []).map((e) => ({
			image_gif: nullableString(e.properties?.image_gif),
			image_static: nullableString(e.properties?.image),
			image_webp: nullableString(e.properties?.image_webp),
			name: e.name || '表情',
		}))

		table.emoji_packages.push({
			emojis: [...fromJson, ...fromItems],
			id: entry.item_id,
			name: entry.name,
		})
	}

	for (const entry of suitItems.thumbup ?? []) {
		const props = entry.properties ?? {}
		table.thumbups.push({
			ani_cut: nullableString(props.image_ani_cut),
			ani_file: nullableString(props.image_ani),
			id: entry.item_id,
			name: entry.name,
			preview: nullableString(props.image_preview),
		})
	}

	for (const entry of suitItems.skin ?? []) {
		const props = entry.properties ?? {}
		table.skins.push({
			color: nullableString(props.color),
			color_mode: nullableString(props.color_mode),
			color_second_page: nullableString(props.color_second_page),
			head_bg: nullableString(props.head_bg),
			head_myself_bg: nullableString(props.head_myself_bg),
			head_myself_mp4_bg: nullableString(props.head_myself_mp4_bg),
			head_myself_squared_bg: nullableString(props.head_myself_squared_bg),
			head_tab_bg: nullableString(props.head_tab_bg),
			id: entry.item_id,
			image_cover: nullableString(props.image_cover),
			image_preview: nullableString(props.image_preview),
			name: entry.name,
			package_md5: nullableString(props.package_md5),
			package_url: nullableString(props.package_url),
			side_bg: nullableString(props.side_bg),
			side_bg_bottom: nullableString(props.side_bg_bottom),
			tail_bg: nullableString(props.tail_bg),
			tail_color: nullableString(props.tail_color),
			tail_color_selected: nullableString(props.tail_color_selected),
			tail_icon_ani: nullableString(props.tail_icon_ani),
			tail_icon_channel: nullableString(props.tail_icon_channel),
			tail_icon_dynamic: nullableString(props.tail_icon_dynamic),
			tail_icon_main: nullableString(props.tail_icon_main),
			tail_icon_myself: nullableString(props.tail_icon_myself),
			tail_icon_pub_btn_bg: nullableString(props.tail_icon_pub_btn_bg),
			tail_icon_selected_channel: nullableString(
				props.tail_icon_selected_channel,
			),
			tail_icon_selected_dynamic: nullableString(
				props.tail_icon_selected_dynamic,
			),
			tail_icon_selected_main: nullableString(props.tail_icon_selected_main),
			tail_icon_selected_myself: nullableString(
				props.tail_icon_selected_myself,
			),
			tail_icon_selected_pub_btn_bg: nullableString(
				props.tail_icon_selected_pub_btn_bg,
			),
			tail_icon_selected_shop: nullableString(props.tail_icon_selected_shop),
			tail_icon_shop: nullableString(props.tail_icon_shop),
		})
	}

	for (const entry of suitItems.loading ?? []) {
		const props = entry.properties ?? {}
		table.loadings.push({
			id: entry.item_id,
			loading_frame_url: nullableString(props.loading_frame_url),
			loading_url: nullableString(props.loading_url),
			name: entry.name,
			preview: nullableString(props.image_preview_small),
		})
	}

	for (const entry of suitItems.play_icon ?? []) {
		const props = entry.properties ?? {}
		table.play_icons.push({
			drag_left_png: nullableString(props.drag_left_png),
			drag_right_png: nullableString(props.drag_right_png),
			id: entry.item_id,
			middle_png: nullableString(props.middle_png),
			name: entry.name,
			squared_image: nullableString(props.squared_image),
			static_icon_image: nullableString(props.static_icon_image),
		})
	}

	return parseSkinAssetDeclaration(table)
}

// ============================================================
// 导出
// ============================================================

export const fetchGarbSkinAssetDeclaration = (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
) => {
	switch (item.kind) {
		case 'collection':
			return buildCollectionAssetDeclaration(item, signal)
		case 'suit':
			return buildSuitAssetDeclaration(item, signal)
		default:
			throw new Error('当前只支持下载收藏集和主题装扮')
	}
}
