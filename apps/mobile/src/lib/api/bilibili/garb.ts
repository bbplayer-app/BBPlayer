type JsonRecord = Record<string, unknown>

export type GarbDownloadKind = 'collection' | 'suit'

export interface BilibiliGarbSearchItem {
	item_id: number
	name: string
	part_id?: number
	group_id?: number
	jump_link?: string
	properties?: JsonRecord
}

export interface GarbSkinSearchResult {
	itemId: number
	name: string
	kind: GarbDownloadKind | null
	partId: number | null
	groupId: number | null
	coverUri: string | null
	actId: string | null
	lotteryId: string | null
	price: number | null
	raw: BilibiliGarbSearchItem
}

export interface UnifiedAssetManifest {
	type: GarbDownloadKind
	name: string
	id: string
	price: number | null
	componentTypes: string[]
	stats: Record<string, number>
	assets: UnifiedAssets
	localAssets?: Partial<UnifiedAssets>
	downloadedFiles?: Record<string, string>
	features?: Record<UnifiedAssetFeature, boolean>
	missingFeatures?: UnifiedAssetFeature[]
}

export type UnifiedAssetFeature =
	| 'cards'
	| 'redeems'
	| 'skin'
	| 'play_icon'
	| 'loading'
	| 'emoji_package'
	| 'thumbup'
	| 'space_bg'
	| 'card'
	| 'card_bg'

export interface UnifiedAssets {
	cards: CardAsset[] | null
	redeems: RedeemAsset[] | null
	skin: SkinAsset | null
	play_icon: PlayIconAsset | null
	loading: LoadingAsset | null
	emoji_package: EmojiAsset[] | null
	thumbup: ThumbupAsset | null
	space_bg: SpaceBgAsset[] | null
	card: CardFrameAsset[] | null
	card_bg: CardBgAsset | null
}

export interface CardAsset {
	name: string
	rarity: number | null
	is_dynamic: boolean
	image_no_watermark: string | null
	image_watermark: string | null
	video_no_watermark: string[]
	video_watermark: string[]
	width: number | null
	height: number | null
}

export interface RedeemAsset {
	type: number | null
	name: string
	preview_image: string | null
	component_ids: string[]
	components: ComponentAsset[]
	is_shared: boolean
}

export type ComponentAsset =
	| { type: 'emoji'; emoji_package: EmojiAsset[] }
	| { type: 'skin'; skin: SkinAsset }
	| { type: 'play_icon'; play_icon: PlayIconAsset }
	| { type: 'loading'; loading: LoadingAsset }
	| { type: 'thumbup'; thumbup: ThumbupAsset }
	| { type: 'unknown'; raw_part_id: number | null; raw_data: unknown }

export interface SkinAsset {
	head_bg: string | null
	head_tab_bg: string | null
	head_myself_bg: string | null
	head_myself_squared_bg: string | null
	head_myself_mp4_bg: string | null
	side_bg: string | null
	side_bg_bottom: string | null
	tail_bg: string | null
	tail_icon_main: string | null
	tail_icon_channel: string | null
	tail_icon_dynamic: string | null
	tail_icon_shop: string | null
	tail_icon_myself: string | null
	tail_icon_pub_btn_bg: string | null
	tail_icon_selected_main: string | null
	tail_icon_selected_channel: string | null
	tail_icon_selected_dynamic: string | null
	tail_icon_selected_shop: string | null
	tail_icon_selected_myself: string | null
	color: string | null
	color_second_page: string | null
	tail_color: string | null
	tail_color_selected: string | null
	color_mode: string | null
	package_url: string | null
	package_md5: string | null
}

export interface PlayIconAsset {
	drag_left_png: string | null
	drag_right_png: string | null
	middle_png: string | null
	static_icon_image: string | null
	squared_image: string | null
	drag_icon: string | null
	drag_icon_gif: string | null
}

export interface LoadingAsset {
	loading_url: string | null
	loading_frame_url: string | null
	preview: string | null
}

export interface EmojiAsset {
	name: string
	image_static: string | null
	image_gif: string | null
	image_webp: string | null
}

export interface ThumbupAsset {
	ani_file: string | null
	ani_cut: string | null
	preview: string | null
}

export interface SpaceBgAsset {
	landscape: string | null
	portrait: string | null
	landscape_video: string | null
	portrait_video: string | null
}

export interface CardFrameAsset {
	image: string | null
	fan_image: string | null
	preview: string | null
}

export interface CardBgAsset {
	image: string | null
	preview: string | null
}

interface BilibiliResponse<T> {
	code: number
	message: string
	data?: T
}

interface BilibiliGarbSearchResponse {
	list?: BilibiliGarbSearchItem[]
}

const API_SEARCH = 'https://api.bilibili.com/x/garb/v2/mall/home/search'
const API_ASSET_BAG = 'https://api.bilibili.com/x/vas/dlc_act/asset_bag'
const API_SUIT_DETAIL = 'https://api.bilibili.com/x/garb/v2/mall/suit/detail'
const API_BENEFIT = 'https://api.bilibili.com/x/garb/v2/user/suit/benefit'

const FEATURE_KEYS: UnifiedAssetFeature[] = [
	'cards',
	'redeems',
	'skin',
	'play_icon',
	'loading',
	'emoji_package',
	'thumbup',
	'space_bg',
	'card',
	'card_bg',
]

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === 'object' && value !== null

const stringValue = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value : null

const numberValue = (value: unknown): number | null =>
	typeof value === 'number' ? value : null

const arrayValue = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : []

const firstProps = (value: unknown, key?: string): JsonRecord => {
	if (!isRecord(value)) return {}
	const source = key ? value[key] : Object.values(value)[0]
	const first = Array.isArray(source) ? source[0] : source
	if (!isRecord(first)) return {}
	return isRecord(first.properties) ? first.properties : {}
}

const findStringByKey = (value: unknown, keys: Set<string>): string | null => {
	if (typeof value === 'string') return null
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findStringByKey(item, keys)
			if (found) return found
		}
		return null
	}
	if (!isRecord(value)) return null

	for (const [key, item] of Object.entries(value)) {
		if (keys.has(key)) {
			const found = stringValue(item)
			if (found) return found
		}

		const found = findStringByKey(item, keys)
		if (found) return found
	}

	return null
}

const getJsonData = async <T>(
	url: string,
	signal?: AbortSignal,
): Promise<T> => {
	const response = await fetch(url, {
		signal,
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			Referer: 'https://www.bilibili.com/',
		},
	})

	if (!response.ok) {
		throw new Error(`请求失败：${response.status} ${response.statusText}`)
	}

	const payload = (await response.json()) as BilibiliResponse<T>
	if (payload.code !== 0 || payload.data === undefined) {
		throw new Error(payload.message || `请求失败：${payload.code}`)
	}

	return payload.data
}

const mapSearchItem = (item: BilibiliGarbSearchItem): GarbSkinSearchResult => {
	const partId = item.part_id ?? null
	const properties = item.properties ?? {}
	const actId = stringValue(properties.dlc_act_id)
	const lotteryId = stringValue(properties.dlc_lottery_id)

	return {
		itemId: item.item_id,
		name: item.name,
		kind: partId === 0 ? 'collection' : partId === 6 ? 'suit' : null,
		partId,
		groupId: item.group_id ?? null,
		coverUri:
			stringValue(properties.image_cover) ??
			findStringByKey(
				item,
				new Set(['image_cover', 'image_preview', 'preview']),
			),
		actId,
		lotteryId,
		price: numberValue(properties.sale_bp_forever_raw),
		raw: item,
	}
}

const createEmptyAssets = (): UnifiedAssets => ({
	cards: null,
	redeems: null,
	skin: null,
	play_icon: null,
	loading: null,
	emoji_package: null,
	thumbup: null,
	space_bg: null,
	card: null,
	card_bg: null,
})

const featureStatus = (assets: UnifiedAssets) => {
	const features = Object.fromEntries(
		FEATURE_KEYS.map((key) => {
			const value = assets[key]
			return [key, Array.isArray(value) ? value.length > 0 : value !== null]
		}),
	) as Record<UnifiedAssetFeature, boolean>

	return {
		features,
		missingFeatures: FEATURE_KEYS.filter((key) => !features[key]),
	}
}

const skinFromProps = (props: JsonRecord): SkinAsset => ({
	head_bg: stringValue(props.head_bg),
	head_tab_bg: stringValue(props.head_tab_bg),
	head_myself_bg: stringValue(props.head_myself_bg),
	head_myself_squared_bg: stringValue(props.head_myself_squared_bg),
	head_myself_mp4_bg: stringValue(props.head_myself_mp4_bg),
	side_bg: stringValue(props.side_bg),
	side_bg_bottom: stringValue(props.side_bg_bottom),
	tail_bg: stringValue(props.tail_bg),
	tail_icon_main: stringValue(props.tail_icon_main),
	tail_icon_channel: stringValue(props.tail_icon_channel),
	tail_icon_dynamic: stringValue(props.tail_icon_dynamic),
	tail_icon_shop: stringValue(props.tail_icon_shop),
	tail_icon_myself: stringValue(props.tail_icon_myself),
	tail_icon_pub_btn_bg: stringValue(props.tail_icon_pub_btn_bg),
	tail_icon_selected_main: stringValue(props.tail_icon_selected_main),
	tail_icon_selected_channel: stringValue(props.tail_icon_selected_channel),
	tail_icon_selected_dynamic: stringValue(props.tail_icon_selected_dynamic),
	tail_icon_selected_shop: stringValue(props.tail_icon_selected_shop),
	tail_icon_selected_myself: stringValue(props.tail_icon_selected_myself),
	color: stringValue(props.color),
	color_second_page: stringValue(props.color_second_page),
	tail_color: stringValue(props.tail_color),
	tail_color_selected: stringValue(props.tail_color_selected),
	color_mode: stringValue(props.color_mode),
	package_url: stringValue(props.package_url),
	package_md5: stringValue(props.package_md5),
})

const playIconFromProps = (props: JsonRecord): PlayIconAsset => ({
	drag_left_png: stringValue(props.drag_left_png),
	drag_right_png: stringValue(props.drag_right_png),
	middle_png: stringValue(props.middle_png),
	static_icon_image: stringValue(props.static_icon_image),
	squared_image: stringValue(props.squared_image),
	drag_icon: stringValue(props.drag_icon),
	drag_icon_gif: stringValue(props.drag_icon_gif),
})

const loadingFromProps = (props: JsonRecord): LoadingAsset => ({
	loading_url: stringValue(props.loading_url),
	loading_frame_url: stringValue(props.loading_frame_url),
	preview: stringValue(props.image_preview_small) ?? stringValue(props.preview),
})

const thumbupFromProps = (props: JsonRecord): ThumbupAsset => ({
	ani_file: stringValue(props.image_ani),
	ani_cut: stringValue(props.image_ani_cut),
	preview: stringValue(props.image_preview),
})

const emojiFromProperties = (props: JsonRecord): EmojiAsset[] => {
	const rawList = stringValue(props.item_emoji_list)
	if (!rawList) return []

	try {
		const parsed = JSON.parse(rawList) as unknown
		return arrayValue(parsed).map((item) => {
			const entry = isRecord(item) ? item : {}
			return {
				name: stringValue(entry.name) ?? '表情',
				image_static: stringValue(entry.image),
				image_gif: stringValue(entry.image_gif),
				image_webp: stringValue(entry.image_webp),
			}
		})
	} catch {
		return []
	}
}

const emojiFromItems = (items: unknown): EmojiAsset[] =>
	arrayValue(items).map((item) => {
		const entry = isRecord(item) ? item : {}
		const props = isRecord(entry.properties) ? entry.properties : {}
		return {
			name: stringValue(entry.name) ?? '表情',
			image_static: stringValue(props.image),
			image_gif: stringValue(props.image_gif),
			image_webp: stringValue(props.image_webp),
		}
	})

const resolveComponent = async (
	componentId: string,
	signal?: AbortSignal,
): Promise<ComponentAsset> => {
	const params = new URLSearchParams({
		item_id: componentId,
		part: 'emoji_package',
	})
	const data = await getJsonData<JsonRecord>(
		`${API_BENEFIT}?${params.toString()}`,
		signal,
	)
	const partId = numberValue(data.part_id)
	const suitItems = isRecord(data.suit_items) ? data.suit_items : {}
	const props = firstProps(suitItems, 'emoji_package')

	switch (partId) {
		case 3:
			return { type: 'thumbup', thumbup: thumbupFromProps(props) }
		case 5: {
			const fallbackItems = isRecord(suitItems.emoji)
				? suitItems.emoji
				: suitItems.emoji_package
			const emoji_package = [
				...emojiFromProperties(
					isRecord(data.properties) ? data.properties : {},
				),
				...emojiFromItems(fallbackItems),
			]
			return { type: 'emoji', emoji_package }
		}
		case 9:
			return { type: 'skin', skin: skinFromProps(props) }
		case 10:
			return { type: 'loading', loading: loadingFromProps(props) }
		case 11:
			return { type: 'play_icon', play_icon: playIconFromProps(props) }
		default:
			return { type: 'unknown', raw_part_id: partId, raw_data: data }
	}
}

const mergeComponentIntoAssets = (
	assets: UnifiedAssets,
	component: ComponentAsset,
) => {
	switch (component.type) {
		case 'emoji':
			assets.emoji_package = [
				...(assets.emoji_package ?? []),
				...component.emoji_package,
			]
			break
		case 'skin':
			assets.skin = component.skin
			break
		case 'play_icon':
			assets.play_icon = component.play_icon
			break
		case 'loading':
			assets.loading = component.loading
			break
		case 'thumbup':
			assets.thumbup = component.thumbup
			break
	}
}

const buildCollectionManifest = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
): Promise<UnifiedAssetManifest> => {
	if (!item.actId || !item.lotteryId) {
		throw new Error('收藏集缺少 act_id 或 lottery_id')
	}

	const params = new URLSearchParams({
		act_id: item.actId,
		lottery_id: item.lotteryId,
	})
	const data = await getJsonData<JsonRecord>(
		`${API_ASSET_BAG}?${params.toString()}`,
		signal,
	)
	const assets = createEmptyAssets()
	const stats: Record<string, number> = { api_calls: 1 }

	assets.cards = arrayValue(data.item_list)
		.map((entry) => (isRecord(entry) ? entry.card_item : null))
		.filter(isRecord)
		.map((card) => ({
			name: stringValue(card.card_name) ?? '卡牌',
			rarity: numberValue(card.card_scarcity),
			is_dynamic: numberValue(card.card_type) === 2,
			image_no_watermark: stringValue(card.card_img),
			image_watermark: stringValue(card.card_img_download),
			video_no_watermark: arrayValue(card.video_list).filter(
				(value): value is string => typeof value === 'string',
			),
			video_watermark: arrayValue(card.video_list_download).filter(
				(value): value is string => typeof value === 'string',
			),
			width: numberValue(card.width),
			height: numberValue(card.height),
		}))

	assets.redeems = []
	for (const entry of arrayValue(data.collect_list)) {
		const redeem = isRecord(entry) ? entry : {}
		const componentIds = (stringValue(redeem.redeem_item_id) ?? '')
			.split('&')
			.map((id) => id.trim())
			.filter(Boolean)
		const components: ComponentAsset[] = []

		for (const componentId of componentIds) {
			const component = await resolveComponent(componentId, signal)
			stats.api_calls += 1
			components.push(component)
			mergeComponentIntoAssets(assets, component)
		}

		assets.redeems.push({
			type: numberValue(redeem.redeem_item_type),
			name: stringValue(redeem.redeem_item_name) ?? '兑换奖励',
			preview_image: stringValue(redeem.redeem_item_image),
			component_ids: componentIds,
			components,
			is_shared: numberValue(redeem.lottery_id) === 0,
		})
	}

	const status = featureStatus(assets)
	return {
		type: 'collection',
		name: item.name,
		id: `act_id=${item.actId}`,
		price: item.price,
		componentTypes: assets.redeems.flatMap((redeem) =>
			redeem.components.map((component) => component.type),
		),
		stats,
		assets,
		...status,
	}
}

const buildSuitManifest = async (
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
): Promise<UnifiedAssetManifest> => {
	const params = new URLSearchParams({ item_id: String(item.itemId) })
	const data = await getJsonData<JsonRecord>(
		`${API_SUIT_DETAIL}?${params.toString()}`,
		signal,
	)
	const suitItems = isRecord(data.suit_items) ? data.suit_items : {}
	const assets = createEmptyAssets()
	const stats: Record<string, number> = { api_calls: 1 }

	if (suitItems.skin) {
		assets.skin = skinFromProps(firstProps(suitItems, 'skin'))
	}
	if (suitItems.play_icon) {
		assets.play_icon = playIconFromProps(firstProps(suitItems, 'play_icon'))
	}
	if (suitItems.loading) {
		assets.loading = loadingFromProps(firstProps(suitItems, 'loading'))
	}
	if (suitItems.emoji_package) {
		const packageItem = arrayValue(suitItems.emoji_package)[0]
		const props =
			isRecord(packageItem) && isRecord(packageItem.properties)
				? packageItem.properties
				: {}
		assets.emoji_package = [
			...emojiFromProperties(props),
			...emojiFromItems(isRecord(packageItem) ? packageItem.items : []),
		]
	}
	if (suitItems.thumbup) {
		assets.thumbup = thumbupFromProps(firstProps(suitItems, 'thumbup'))
	}
	if (suitItems.space_bg) {
		assets.space_bg = arrayValue(suitItems.space_bg).map((entry) => {
			const props =
				isRecord(entry) && isRecord(entry.properties) ? entry.properties : {}
			return {
				landscape: stringValue(props.image1_landscape),
				portrait: stringValue(props.image1_portrait),
				landscape_video: stringValue(props.space_1_mp4_horizontal),
				portrait_video: stringValue(props.space_1_mp4_vertical),
			}
		})
	}
	if (suitItems.card) {
		assets.card = arrayValue(suitItems.card).map((entry) => {
			const props =
				isRecord(entry) && isRecord(entry.properties) ? entry.properties : {}
			return {
				image: stringValue(props.image),
				fan_image: stringValue(props.fans_image),
				preview: stringValue(props.image_preview_small),
			}
		})
	}
	if (suitItems.card_bg) {
		const props = firstProps(suitItems, 'card_bg')
		assets.card_bg = {
			image: stringValue(props.image),
			preview: stringValue(props.image_preview_small),
		}
	}

	const status = featureStatus(assets)
	return {
		type: 'suit',
		name: item.name,
		id: `item_id=${item.itemId}`,
		price: item.price,
		componentTypes: Object.keys(suitItems),
		stats,
		assets,
		...status,
	}
}

export async function searchGarbSkins(
	query: string,
	signal?: AbortSignal,
): Promise<GarbSkinSearchResult[]> {
	const params = new URLSearchParams({
		key_word: query,
		ps: '20',
		pn: '1',
	})
	const data = await getJsonData<BilibiliGarbSearchResponse>(
		`${API_SEARCH}?${params.toString()}`,
		signal,
	)

	return (data.list ?? []).map(mapSearchItem)
}

export async function buildGarbAssetManifest(
	item: GarbSkinSearchResult,
	signal?: AbortSignal,
): Promise<UnifiedAssetManifest> {
	if (item.kind === 'collection') {
		return buildCollectionManifest(item, signal)
	}
	if (item.kind === 'suit') {
		return buildSuitManifest(item, signal)
	}
	throw new Error('暂不支持下载这个装扮类型')
}
