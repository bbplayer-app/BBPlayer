import {
	parseSkinAssetDeclaration,
	type SkinAssetDeclaration,
} from '@/lib/theme/skins'

const API_BASE = 'https://api.bilibili.com'

const GARb_HEADERS = {
	Referer: 'https://www.bilibili.com/',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

type GarbSkinKind = 'collection' | 'suit'

export interface GarbSkinSearchResult {
	actId: number | null
	coverUri: string | null
	itemId: number | null
	kind: GarbSkinKind | null
	lotteryId: number | null
	name: string
	partId: number | null
}

interface BilibiliResponse<T> {
	code: number
	data: T
	message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

const arrayValue = <T = unknown>(value: unknown): T[] =>
	Array.isArray(value) ? (value as T[]) : []

const recordValue = (value: unknown): Record<string, unknown> =>
	isRecord(value) ? value : {}

const stringValue = (value: unknown) =>
	typeof value === 'string' && value.trim().length > 0 ? value : null

const numberValue = (value: unknown) => {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (typeof value === 'string' && value.trim().length > 0) {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) return parsed
	}
	return null
}

const idValue = (value: unknown) => numberValue(value) ?? 0

const propertyString = (props: Record<string, unknown>, key: string) =>
	stringValue(props[key])

const getJsonData = async <T>(
	endpoint: string,
	params: Record<string, number | string>,
	signal?: AbortSignal,
): Promise<T> => {
	const url = new URL(endpoint, API_BASE)
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.append(key, String(value))
	}

	const response = await fetch(url.toString(), {
		headers: GARb_HEADERS,
		signal,
	})
	if (!response.ok) {
		throw new Error(`请求 B 站装扮接口失败：${response.status}`)
	}

	const payload = (await response.json()) as BilibiliResponse<T>
	if (payload.code !== 0) {
		throw new Error(payload.message || `B 站装扮接口返回 ${payload.code}`)
	}

	return payload.data
}

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

const firstSuitItemProperties = (
	suitItems: Record<string, unknown>,
	key: string,
) => {
	const item = arrayValue<Record<string, unknown>>(suitItems[key])[0]
	return recordValue(item?.properties)
}

const benefitProperties = (
	data: Record<string, unknown>,
	preferredKey = 'emoji_package',
) => {
	const suitItems = recordValue(data.suit_items)
	const preferred = firstSuitItemProperties(suitItems, preferredKey)
	if (Object.keys(preferred).length > 0) return preferred

	const fallback = firstSuitItemProperties(suitItems, 'emoji_package')
	if (Object.keys(fallback).length > 0) return fallback

	return recordValue(data.properties)
}

const parseVideoList = (value: unknown) => {
	const list = arrayValue(value).filter((item): item is string => {
		return typeof item === 'string' && item.trim().length > 0
	})
	return list.length > 0 ? list : null
}

const parseCard = (value: unknown, fallbackIndex: number) => {
	const card = recordValue(value)
	return {
		img: propertyString(card, 'card_img') ?? '',
		name: propertyString(card, 'card_name') ?? `卡牌 ${fallbackIndex + 1}`,
		type_id:
			numberValue(card.card_type_id) ??
			stringValue(card.card_type_id) ??
			`card_${fallbackIndex + 1}`,
		video_list: parseVideoList(card.video_list),
	}
}

const parseEmojiList = (value: unknown) => {
	const raw = stringValue(value)
	if (!raw) return null

	try {
		return arrayValue<Record<string, unknown>>(JSON.parse(raw)).map((item) => ({
			image_gif: propertyString(item, 'image_gif'),
			image_static: propertyString(item, 'image'),
			image_webp: propertyString(item, 'image_webp'),
			name: propertyString(item, 'name') ?? '表情',
		}))
	} catch {
		return null
	}
}

const parseEmojiItems = (items: unknown) =>
	arrayValue<Record<string, unknown>>(items).map((item) => {
		const props = recordValue(item.properties)
		return {
			image_gif: propertyString(props, 'image_gif'),
			image_static: propertyString(props, 'image'),
			image_webp: propertyString(props, 'image_webp'),
			name: propertyString(item, 'name') ?? '表情',
		}
	})

const extractSkinAsset = (
	id: number,
	name: string | null,
	props: Record<string, unknown>,
) => ({
	color: propertyString(props, 'color'),
	color_mode: propertyString(props, 'color_mode'),
	color_second_page: propertyString(props, 'color_second_page'),
	head_bg: propertyString(props, 'head_bg'),
	head_myself_bg: propertyString(props, 'head_myself_bg'),
	head_myself_mp4_bg: propertyString(props, 'head_myself_mp4_bg'),
	head_myself_squared_bg: propertyString(props, 'head_myself_squared_bg'),
	head_tab_bg: propertyString(props, 'head_tab_bg'),
	id,
	image_cover: propertyString(props, 'image_cover'),
	image_preview: propertyString(props, 'image_preview'),
	name,
	package_md5: propertyString(props, 'package_md5'),
	package_url: propertyString(props, 'package_url'),
	side_bg: propertyString(props, 'side_bg'),
	side_bg_bottom: propertyString(props, 'side_bg_bottom'),
	tail_bg: propertyString(props, 'tail_bg'),
	tail_color: propertyString(props, 'tail_color'),
	tail_color_selected: propertyString(props, 'tail_color_selected'),
	tail_icon_ani: propertyString(props, 'tail_icon_ani'),
	tail_icon_channel: propertyString(props, 'tail_icon_channel'),
	tail_icon_dynamic: propertyString(props, 'tail_icon_dynamic'),
	tail_icon_main: propertyString(props, 'tail_icon_main'),
	tail_icon_myself: propertyString(props, 'tail_icon_myself'),
	tail_icon_pub_btn_bg: propertyString(props, 'tail_icon_pub_btn_bg'),
	tail_icon_selected_channel: propertyString(
		props,
		'tail_icon_selected_channel',
	),
	tail_icon_selected_dynamic: propertyString(
		props,
		'tail_icon_selected_dynamic',
	),
	tail_icon_selected_main: propertyString(props, 'tail_icon_selected_main'),
	tail_icon_selected_myself: propertyString(props, 'tail_icon_selected_myself'),
	tail_icon_selected_pub_btn_bg: propertyString(
		props,
		'tail_icon_selected_pub_btn_bg',
	),
	tail_icon_selected_shop: propertyString(props, 'tail_icon_selected_shop'),
	tail_icon_shop: propertyString(props, 'tail_icon_shop'),
})

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

const resolveComponent = async (
	componentId: string,
	componentName: string | null,
	signal?: AbortSignal,
) => {
	const data = recordValue(
		await getJsonData<unknown>(
			'/x/garb/v2/user/suit/benefit',
			{
				item_id: componentId,
				part: 'emoji_package',
			},
			signal,
		),
	)
	const partId = numberValue(data.part_id)
	const id = idValue(componentId)
	const suitItems = recordValue(data.suit_items)

	switch (partId) {
		case 1: {
			const props = benefitProperties(data, 'card')
			return {
				data: {
					id,
					image: propertyString(props, 'image'),
					name: componentName,
				},
				partId,
			}
		}
		case 3: {
			const props = benefitProperties(data)
			return {
				data: {
					ani_cut: propertyString(props, 'image_ani_cut'),
					ani_file: propertyString(props, 'image_ani'),
					id,
					name: componentName,
					preview: propertyString(props, 'image_preview'),
				},
				partId,
			}
		}
		case 5: {
			const topProps = recordValue(data.properties)
			const packageItem =
				arrayValue<Record<string, unknown>>(suitItems.emoji_package)[0] ?? null
			const packageProps = recordValue(packageItem?.properties)
			const fromJson =
				parseEmojiList(topProps.item_emoji_list) ??
				parseEmojiList(packageProps.item_emoji_list) ??
				[]
			const fromItems = [
				...parseEmojiItems(suitItems.emoji),
				...parseEmojiItems(packageItem?.items),
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
		case 9:
			return {
				data: extractSkinAsset(id, componentName, benefitProperties(data)),
				partId,
			}
		case 10: {
			const props = benefitProperties(data)
			return {
				data: {
					id,
					loading_frame_url: propertyString(props, 'loading_frame_url'),
					loading_url: propertyString(props, 'loading_url'),
					name: componentName,
					preview: propertyString(props, 'image_preview_small'),
				},
				partId,
			}
		}
		case 11: {
			const props = benefitProperties(data)
			return {
				data: {
					drag_left_png: propertyString(props, 'drag_left_png'),
					drag_right_png: propertyString(props, 'drag_right_png'),
					id,
					middle_png: propertyString(props, 'middle_png'),
					name: componentName,
					squared_image: propertyString(props, 'squared_image'),
					static_icon_image: propertyString(props, 'static_icon_image'),
				},
				partId,
			}
		}
		default:
			return { data: null, partId: null }
	}
}

const parseReward = async (
	table: SkinAssetDeclaration,
	entry: Record<string, unknown>,
	index: number,
	signal?: AbortSignal,
) => {
	const itemType = numberValue(entry.redeem_item_type)
	const itemId = stringValue(entry.redeem_item_id)
	const itemName = stringValue(entry.redeem_item_name)

	if (itemType === 1) {
		const cardItem = recordValue(entry.card_item)
		const cardAssetInfo = recordValue(cardItem.card_asset_info)
		const card =
			cardAssetInfo.card_item ??
			cardAssetInfo.card_info ??
			cardItem.card_item ??
			cardItem.card_info ??
			cardItem

		table.cards.push(parseCard(card, table.cards.length + index))
		return
	}

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

const collectListEntries = (value: unknown) => {
	if (Array.isArray(value)) return value as Record<string, unknown>[]
	const record = recordValue(value)
	return [
		...arrayValue<Record<string, unknown>>(record.collect_infos),
		...arrayValue<Record<string, unknown>>(record.collect_chain),
	]
}

const buildCollectionAssetDeclaration = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
) => {
	if (!item.actId || !item.lotteryId) {
		throw new Error('收藏集搜索结果缺少 act_id 或 lottery_id')
	}

	const data = recordValue(
		await getJsonData<unknown>(
			'/x/vas/dlc_act/asset_bag',
			{
				act_id: item.actId,
				lottery_id: item.lotteryId,
			},
			signal,
		),
	)
	const table = emptyAssetDeclaration({
		act_id: item.actId,
		lottery_id: item.lotteryId,
		name: item.name,
		type: 'collection',
	})

	arrayValue<Record<string, unknown>>(data.item_list).forEach(
		(entry, index) => {
			table.cards.push(parseCard(entry.card_item ?? entry.card_info, index))
		},
	)

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

	const data = recordValue(
		await getJsonData<unknown>(
			'/x/garb/v2/mall/suit/detail',
			{ item_id: item.itemId },
			signal,
		),
	)
	const suitItems = recordValue(data.suit_items)
	const table = emptyAssetDeclaration({
		item_id: item.itemId,
		name: item.name,
		type: 'suit',
	})
	let nextCardId = 1

	for (const entry of arrayValue<Record<string, unknown>>(suitItems.card)) {
		const props = recordValue(entry.properties)
		table.avatar_frames.push({
			id: idValue(entry.item_id),
			image: propertyString(props, 'image'),
			name: propertyString(entry, 'name'),
		})
	}

	for (const entry of arrayValue<Record<string, unknown>>(suitItems.card_bg)) {
		const props = recordValue(entry.properties)
		table.card_backgrounds.push({
			id: idValue(entry.item_id),
			image: propertyString(props, 'image'),
			name: propertyString(entry, 'name') ?? item.name,
			preview: propertyString(props, 'image_preview_small'),
		})
	}

	for (const entry of arrayValue<Record<string, unknown>>(suitItems.space_bg)) {
		const props = recordValue(entry.properties)
		const images = []

		for (let index = 1; index <= 8; index += 1) {
			const landscape = propertyString(props, `image${index}_landscape`)
			const portrait = propertyString(props, `image${index}_portrait`)
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
			id: idValue(entry.item_id),
			images,
			name: propertyString(entry, 'name') ?? item.name,
		})
	}

	for (const entry of arrayValue<Record<string, unknown>>(
		suitItems.emoji_package,
	)) {
		const props = recordValue(entry.properties)
		const emojis = [
			...(parseEmojiList(props.item_emoji_list) ?? []),
			...parseEmojiItems(entry.items),
		]
		table.emoji_packages.push({
			emojis,
			id: idValue(entry.item_id),
			name: propertyString(entry, 'name'),
		})
	}

	for (const entry of arrayValue<Record<string, unknown>>(suitItems.thumbup)) {
		const props = recordValue(entry.properties)
		table.thumbups.push({
			ani_cut: propertyString(props, 'image_ani_cut'),
			ani_file: propertyString(props, 'image_ani'),
			id: idValue(entry.item_id),
			name: propertyString(entry, 'name'),
			preview: propertyString(props, 'image_preview'),
		})
	}

	for (const entry of arrayValue<Record<string, unknown>>(suitItems.skin)) {
		table.skins.push(
			extractSkinAsset(
				idValue(entry.item_id),
				propertyString(entry, 'name'),
				recordValue(entry.properties),
			),
		)
	}

	for (const entry of arrayValue<Record<string, unknown>>(suitItems.loading)) {
		const props = recordValue(entry.properties)
		table.loadings.push({
			id: idValue(entry.item_id),
			loading_frame_url: propertyString(props, 'loading_frame_url'),
			loading_url: propertyString(props, 'loading_url'),
			name: propertyString(entry, 'name'),
			preview: propertyString(props, 'image_preview_small'),
		})
	}

	for (const entry of arrayValue<Record<string, unknown>>(
		suitItems.play_icon,
	)) {
		const props = recordValue(entry.properties)
		table.play_icons.push({
			drag_left_png: propertyString(props, 'drag_left_png'),
			drag_right_png: propertyString(props, 'drag_right_png'),
			id: idValue(entry.item_id),
			middle_png: propertyString(props, 'middle_png'),
			name: propertyString(entry, 'name'),
			squared_image: propertyString(props, 'squared_image'),
			static_icon_image: propertyString(props, 'static_icon_image'),
		})
	}

	return parseSkinAssetDeclaration(table)
}

export const searchGarbSkins = async (
	keyword: string,
	signal?: AbortSignal,
): Promise<GarbSkinSearchResult[]> => {
	const data = recordValue(
		await getJsonData<unknown>(
			'/x/garb/v2/mall/home/search',
			{
				key_word: keyword,
				pn: 1,
				ps: 20,
			},
			signal,
		),
	)

	return arrayValue<Record<string, unknown>>(data.list).map((entry) => {
		const partId = numberValue(entry.part_id)
		const props = recordValue(entry.properties)
		return {
			actId: numberValue(props.dlc_act_id),
			coverUri:
				propertyString(props, 'image_cover') ??
				propertyString(props, 'image_cover_long') ??
				propertyString(props, 'fan_share_image'),
			itemId: numberValue(entry.item_id),
			kind: partId === 0 ? 'collection' : partId === 6 ? 'suit' : null,
			lotteryId: numberValue(props.dlc_lottery_id),
			name: propertyString(entry, 'name') ?? '未命名装扮',
			partId,
		}
	})
}

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
