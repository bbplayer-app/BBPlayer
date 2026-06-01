#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const API_SEARCH = 'https://api.bilibili.com/x/garb/v2/mall/home/search'
const API_ASSET_BAG = 'https://api.bilibili.com/x/vas/dlc_act/asset_bag'
const API_SUIT_DETAIL = 'https://api.bilibili.com/x/garb/v2/mall/suit/detail'
const API_BENEFIT = 'https://api.bilibili.com/x/garb/v2/user/suit/benefit'

const FEATURE_KEYS = [
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

const keyword = process.argv[2] ?? '晴空向光行'
const outDir = path.resolve('bilibili_skin_exp/garb-debug/latest')

const isRecord = (value) => typeof value === 'object' && value !== null
const stringValue = (value) =>
	typeof value === 'string' && value.trim() ? value : null
const numberValue = (value) => (typeof value === 'number' ? value : null)
const arrayValue = (value) => (Array.isArray(value) ? value : [])

const getJsonData = async (url) => {
	const response = await fetch(url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			Referer: 'https://www.bilibili.com/',
		},
	})
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}: ${url}`)
	}
	const payload = await response.json()
	if (payload.code !== 0) {
		throw new Error(`${payload.code} ${payload.message}: ${url}`)
	}
	return payload.data
}

const firstProps = (suitItems, key) => {
	if (!isRecord(suitItems)) return {}
	const value = key ? suitItems[key] : Object.values(suitItems)[0]
	const first = Array.isArray(value) ? value[0] : value
	return isRecord(first?.properties) ? first.properties : {}
}

const emptyAssets = () => ({
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

const featuresFor = (assets) => {
	const features = Object.fromEntries(
		FEATURE_KEYS.map((key) => {
			const value = assets[key]
			return [key, Array.isArray(value) ? value.length > 0 : value !== null]
		}),
	)
	return {
		features,
		missingFeatures: FEATURE_KEYS.filter((key) => !features[key]),
	}
}

const skinFromProps = (props) => ({
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

const playIconFromProps = (props) => ({
	drag_left_png: stringValue(props.drag_left_png),
	drag_right_png: stringValue(props.drag_right_png),
	middle_png: stringValue(props.middle_png),
	static_icon_image: stringValue(props.static_icon_image),
	squared_image: stringValue(props.squared_image),
	drag_icon: stringValue(props.drag_icon),
	drag_icon_gif: stringValue(props.drag_icon_gif),
})

const loadingFromProps = (props) => ({
	loading_url: stringValue(props.loading_url),
	loading_frame_url: stringValue(props.loading_frame_url),
	preview: stringValue(props.image_preview_small),
})

const thumbupFromProps = (props) => ({
	ani_file: stringValue(props.image_ani),
	ani_cut: stringValue(props.image_ani_cut),
	preview: stringValue(props.image_preview),
})

const emojiFromProperties = (props) => {
	const raw = stringValue(props.item_emoji_list)
	if (!raw) return []
	try {
		return arrayValue(JSON.parse(raw)).map((item) => ({
			name: stringValue(item.name) ?? '表情',
			image_static: stringValue(item.image),
			image_gif: stringValue(item.image_gif),
			image_webp: stringValue(item.image_webp),
		}))
	} catch {
		return []
	}
}

const emojiFromItems = (items) =>
	arrayValue(items).map((item) => {
		const props = isRecord(item.properties) ? item.properties : {}
		return {
			name: stringValue(item.name) ?? '表情',
			image_static: stringValue(props.image),
			image_gif: stringValue(props.image_gif),
			image_webp: stringValue(props.image_webp),
		}
	})

const resolveComponent = async (componentId) => {
	const params = new URLSearchParams({
		item_id: componentId,
		part: 'emoji_package',
	})
	const data = await getJsonData(`${API_BENEFIT}?${params.toString()}`)
	if (!isRecord(data)) {
		return { type: 'unknown', raw_part_id: null, raw_data: data }
	}

	const partId = numberValue(data.part_id)
	const suitItems = isRecord(data.suit_items) ? data.suit_items : {}
	const props = firstProps(suitItems, 'emoji_package')

	switch (partId) {
		case 3:
			return { type: 'thumbup', thumbup: thumbupFromProps(props) }
		case 5:
			return {
				type: 'emoji',
				emoji_package: [
					...emojiFromProperties(
						isRecord(data.properties) ? data.properties : {},
					),
					...emojiFromItems(suitItems.emoji ?? suitItems.emoji_package),
				],
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

const mergeComponent = (assets, component) => {
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

const buildCollectionManifest = async (item) => {
	const params = new URLSearchParams({
		act_id: item.actId,
		lottery_id: item.lotteryId,
	})
	const data = await getJsonData(`${API_ASSET_BAG}?${params.toString()}`)
	const assets = emptyAssets()
	const stats = { api_calls: 1 }
	assets.cards = arrayValue(data.item_list)
		.map((entry) => entry.card_item)
		.filter(isRecord)
		.map((card) => ({
			name: stringValue(card.card_name) ?? '卡牌',
			rarity: numberValue(card.card_scarcity),
			is_dynamic: numberValue(card.card_type) === 2,
			image_no_watermark: stringValue(card.card_img),
			image_watermark: null,
			video_no_watermark: arrayValue(card.video_list)
				.filter((value) => typeof value === 'string')
				.slice(0, 1),
			video_watermark: [],
			width: numberValue(card.width),
			height: numberValue(card.height),
		}))
	assets.redeems = []
	for (const entry of arrayValue(data.collect_list)) {
		const componentIds = (stringValue(entry.redeem_item_id) ?? '')
			.split('&')
			.map((id) => id.trim())
			.filter(Boolean)
		const components = []
		for (const id of componentIds) {
			const component = await resolveComponent(id)
			stats.api_calls += 1
			components.push(component)
			mergeComponent(assets, component)
		}
		assets.redeems.push({
			type: numberValue(entry.redeem_item_type),
			name: stringValue(entry.redeem_item_name) ?? '兑换奖励',
			preview_image: stringValue(entry.redeem_item_image),
			component_ids: componentIds,
			components,
			is_shared: numberValue(entry.lottery_id) === 0,
		})
	}
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
		...featuresFor(assets),
	}
}

const buildSuitManifest = async (item) => {
	const params = new URLSearchParams({ item_id: String(item.itemId) })
	const data = await getJsonData(`${API_SUIT_DETAIL}?${params.toString()}`)
	const suitItems = isRecord(data.suit_items) ? data.suit_items : {}
	const assets = emptyAssets()
	if (suitItems.skin) assets.skin = skinFromProps(firstProps(suitItems, 'skin'))
	if (suitItems.play_icon) {
		assets.play_icon = playIconFromProps(firstProps(suitItems, 'play_icon'))
	}
	if (suitItems.loading)
		assets.loading = loadingFromProps(firstProps(suitItems, 'loading'))
	if (suitItems.emoji_package) {
		const pkg = arrayValue(suitItems.emoji_package)[0] ?? {}
		const props = isRecord(pkg.properties) ? pkg.properties : {}
		assets.emoji_package = [
			...emojiFromProperties(props),
			...emojiFromItems(pkg.items),
		]
	}
	if (suitItems.thumbup) {
		assets.thumbup = thumbupFromProps(firstProps(suitItems, 'thumbup'))
	}
	if (suitItems.space_bg) {
		assets.space_bg = arrayValue(suitItems.space_bg).map((entry) => {
			const props = isRecord(entry.properties) ? entry.properties : {}
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
			const props = isRecord(entry.properties) ? entry.properties : {}
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
	return {
		type: 'suit',
		name: item.name,
		id: `item_id=${item.itemId}`,
		price: item.price,
		componentTypes: Object.keys(suitItems),
		stats: { api_calls: 1 },
		assets,
		...featuresFor(assets),
	}
}

const search = async () => {
	const params = new URLSearchParams({ key_word: keyword, ps: '20', pn: '1' })
	const data = await getJsonData(`${API_SEARCH}?${params.toString()}`)
	return arrayValue(data.list).map((item) => {
		const partId = numberValue(item.part_id)
		const props = isRecord(item.properties) ? item.properties : {}
		return {
			itemId: numberValue(item.item_id) ?? 0,
			name: stringValue(item.name) ?? 'unknown',
			kind: partId === 0 ? 'collection' : partId === 6 ? 'suit' : null,
			partId,
			groupId: numberValue(item.group_id),
			coverUri: stringValue(props.image_cover),
			actId: stringValue(props.dlc_act_id),
			lotteryId: stringValue(props.dlc_lottery_id),
			price: numberValue(props.sale_bp_forever_raw),
			raw: item,
		}
	})
}

const extensionFromUrl = (url, fallback) => {
	try {
		const extension = new URL(url).pathname.match(/\.[A-Za-z0-9]+$/)?.[0]
		return extension?.toLowerCase() ?? fallback
	} catch {
		return fallback
	}
}

const isRemoteUrl = (value) =>
	typeof value === 'string' && /^https?:\/\//.test(value)

const rawAssetPath = (assetPath, url) =>
	`raw_assets/${assetPath.replace(/[^A-Za-z0-9._/-]+/g, '_')}${extensionFromUrl(url, '.bin')}`

const collectRawPaths = (value, assetPath = 'assets', result = []) => {
	if (typeof value === 'string') {
		if (isRemoteUrl(value)) result.push(rawAssetPath(assetPath, value))
		return result
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) =>
			collectRawPaths(item, `${assetPath}/${index}`, result),
		)
		return result
	}
	if (isRecord(value)) {
		Object.entries(value).forEach(([key, item]) =>
			collectRawPaths(item, `${assetPath}/${key}`, result),
		)
	}
	return result
}

const semanticPaths = (assets) =>
	[
		assets.skin?.head_bg && 'skin/head_bg.jpg',
		assets.skin?.head_tab_bg && 'skin/head_tab_bg.png',
		assets.skin?.tail_bg && 'skin/tail_bg.png',
		assets.skin?.tail_icon_main && 'skin/tail_icon_main.png',
		assets.skin?.tail_icon_channel && 'skin/tail_icon_channel.png',
		assets.skin?.tail_icon_myself && 'skin/tail_icon_myself.png',
		assets.skin?.tail_icon_selected_main && 'skin/tail_icon_selected_main.png',
		assets.skin?.tail_icon_selected_channel &&
			'skin/tail_icon_selected_channel.png',
		assets.skin?.tail_icon_selected_myself &&
			'skin/tail_icon_selected_myself.png',
		assets.play_icon?.drag_left_png && 'play_icon/drag_left.png',
		assets.play_icon?.drag_right_png && 'play_icon/drag_right.png',
		assets.play_icon?.middle_png && 'play_icon/middle.png',
		assets.play_icon?.static_icon_image && 'play_icon/static_icon_image.png',
		assets.loading?.loading_url && 'loading/loading.png',
		assets.loading?.loading_frame_url && 'loading/loading_frame.png',
		assets.thumbup?.ani_file && 'thumbup/image_ani.bin',
		assets.thumbup?.preview && 'thumbup/image_preview.png',
		...(assets.cards ?? []).flatMap((card, index) => {
			const prefix = `cards/${String(index).padStart(2, '0')}`
			return [
				card.image_no_watermark &&
					`${prefix}/image_no_watermark${extensionFromUrl(card.image_no_watermark, '.png')}`,
				...card.video_no_watermark.map(
					(_, videoIndex) => `${prefix}/video_no_watermark_${videoIndex}.mp4`,
				),
			]
		}),
	].filter(Boolean)

const pathReport = (manifest) => {
	const paths = [
		...collectRawPaths(manifest.assets),
		...semanticPaths(manifest.assets),
	]
	const counts = new Map()
	paths.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1))
	const duplicates = [...counts.entries()].filter(([, count]) => count > 1)
	const fileSet = new Set(paths)
	const prefixConflicts = []
	for (const item of paths) {
		const parts = item.split('/')
		for (let index = 1; index < parts.length; index += 1) {
			const prefix = parts.slice(0, index).join('/')
			if (fileSet.has(prefix)) {
				prefixConflicts.push({ file: prefix, child: item })
			}
		}
	}
	return {
		fileCount: paths.length,
		duplicateCount: duplicates.length,
		duplicates,
		prefixConflictCount: prefixConflicts.length,
		prefixConflicts,
		firstPaths: paths.slice(0, 80),
	}
}

const writeJson = async (name, value) => {
	await fs.writeFile(
		path.join(outDir, name),
		`${JSON.stringify(value, null, 2)}\n`,
	)
}

await fs.rm(outDir, { recursive: true, force: true })
await fs.mkdir(outDir, { recursive: true })

const results = await search()
await writeJson('search-results.json', results)

const collection = results.find((item) => item.kind === 'collection')
const suit = results.find((item) => item.kind === 'suit')

if (collection) {
	const manifest = await buildCollectionManifest(collection)
	await writeJson('collection-bili-assets.json', manifest)
	await writeJson('collection-path-report.json', pathReport(manifest))
}

if (suit) {
	const manifest = await buildSuitManifest(suit)
	await writeJson('suit-bili-assets.json', manifest)
	await writeJson('suit-path-report.json', pathReport(manifest))
}

process.stdout.write(`Wrote garb debug files to ${outDir}\n`)
