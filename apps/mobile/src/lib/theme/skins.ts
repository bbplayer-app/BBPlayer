import { ArkErrors, type as arkType } from 'arktype'

const nullableString = 'string | null = null'

const cardAssetSchema = arkType({
	name: 'string',
	type_id: 'number | string',
	img: 'string',
	video_list: 'string[] | null = null',
})

const avatarFrameAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	image: nullableString,
})

const thumbUpAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	ani_file: nullableString,
	ani_cut: nullableString,
	preview: nullableString,
})

const skinAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	head_bg: nullableString,
	head_tab_bg: nullableString,
	head_myself_bg: nullableString,
	head_myself_squared_bg: nullableString,
	head_myself_mp4_bg: nullableString,
	side_bg: nullableString,
	side_bg_bottom: nullableString,
	tail_bg: nullableString,
	tail_icon_main: nullableString,
	tail_icon_channel: nullableString,
	tail_icon_dynamic: nullableString,
	tail_icon_shop: nullableString,
	tail_icon_myself: nullableString,
	tail_icon_pub_btn_bg: nullableString,
	tail_icon_ani: nullableString,
	tail_icon_selected_main: nullableString,
	tail_icon_selected_channel: nullableString,
	tail_icon_selected_dynamic: nullableString,
	tail_icon_selected_shop: nullableString,
	tail_icon_selected_myself: nullableString,
	tail_icon_selected_pub_btn_bg: nullableString,
	color: nullableString,
	color_second_page: nullableString,
	tail_color: nullableString,
	tail_color_selected: nullableString,
	color_mode: nullableString,
	package_url: nullableString,
	package_md5: nullableString,
	image_cover: nullableString,
	image_preview: nullableString,
})

const loadingAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	loading_url: nullableString,
	loading_frame_url: nullableString,
	preview: nullableString,
})

const playIconAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	drag_left_png: nullableString,
	drag_right_png: nullableString,
	middle_png: nullableString,
	static_icon_image: nullableString,
	squared_image: nullableString,
})

const spaceBackgroundAssetSchema = arkType({
	id: 'number',
	name: 'string',
	images: arkType({
		landscape: nullableString,
		portrait: nullableString,
	}).array(),
})

const cardBackgroundAssetSchema = arkType({
	id: 'number',
	name: 'string',
	image: nullableString,
	preview: nullableString,
})

export const skinAssetDeclarationSchema = arkType({
	type: "'collection' | 'suit'",
	name: 'string',
	'act_id?': 'number',
	'lottery_id?': 'number',
	'item_id?': 'number',
	cards: cardAssetSchema.array(),
	avatar_frames: avatarFrameAssetSchema.array(),
	card_backgrounds: cardBackgroundAssetSchema.array(),
	space_backgrounds: spaceBackgroundAssetSchema.array(),
	thumbups: thumbUpAssetSchema.array(),
	skins: skinAssetSchema.array(),
	loadings: loadingAssetSchema.array(),
	play_icons: playIconAssetSchema.array(),
})

export type SkinAssetDeclaration = typeof skinAssetDeclarationSchema.infer
export type SkinCardAsset = typeof cardAssetSchema.infer
export type SkinAsset = typeof skinAssetSchema.infer
export type SkinPlayIconAsset = typeof playIconAssetSchema.infer
export type SkinThumbUpAsset = typeof thumbUpAssetSchema.infer
export type SkinLoadingAsset = typeof loadingAssetSchema.infer

export interface SkinAssetFeatures {
	avatarFrames: boolean
	cardBackgrounds: boolean
	cards: boolean
	loadings: boolean
	playIcons: boolean
	skins: boolean
	spaceBackgrounds: boolean
	thumbups: boolean
}

export interface SkinFrameSequence {
	count: number
	directoryPath: string
	fps: number
	height: number
	width: number
}

export interface InstalledSkinPackageDirectory {
	directoryPath: string
	fileCount: number
	skinId: number
}

export interface InstalledSkin {
	assetFeatures: SkinAssetFeatures
	coverUri: string | null
	id: string
	installedAt: number
	localAssets: SkinAssetDeclaration
	name: string
	packageDirectories?: InstalledSkinPackageDirectory[]
	rootUri: string
	source:
		| {
				actId: number
				kind: 'collection'
				lotteryId: number
		  }
		| {
				itemId: number
				kind: 'suit'
		  }
	thumbUpFrames?: SkinFrameSequence[]
}

/** 存储在 Zustand 里的轻量元数据（不含 localAssets） */
export interface InstalledSkinMeta {
	assetFeatures: SkinAssetFeatures
	coverUri: string | null
	id: string
	installedAt: number
	name: string
	rootUri: string
	source: InstalledSkin['source']
}

export const installedSkinToMeta = (
	skin: InstalledSkin,
): InstalledSkinMeta => ({
	assetFeatures: skin.assetFeatures,
	coverUri: skin.coverUri,
	id: skin.id,
	installedAt: skin.installedAt,
	name: skin.name,
	rootUri: skin.rootUri,
	source: skin.source,
})

export interface SkinImageResource {
	scale?: number
	uri: string
}

export interface SkinBootSplashAsset {
	card: SkinImageResource
	id: string
	name: string
	video?: SkinImageResource | null
}

export interface AppSkin {
	background: {
		head: SkinImageResource
	}
	bootSplash: {
		items: SkinBootSplashAsset[]
	}
	colors: {
		color: string | null
		colorMode: string | null
		colorSecondPage: string | null
		tailColor: string | null
		tailColorSelected: string | null
	}
	id: string
	name: string
	player: {
		sliderThumb: {
			dragLeft: SkinImageResource
			dragRight: SkinImageResource
			normal: SkinImageResource
		}
		thumbUp: {
			frames: (SkinFrameSequence & { directoryUri: string }) | null
			preview: SkinImageResource | null
		} | null
	}
	tabBar: {
		background: SkinImageResource | null
		icons: {
			home: {
				default: SkinImageResource
				selected: SkinImageResource
			}
			library: {
				default: SkinImageResource
				selected: SkinImageResource
			}
			settings: {
				default: SkinImageResource
				selected: SkinImageResource
			}
		}
	}
}

const TRANSPARENT_PIXEL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR42mP8z8BQDwAFgwJ/l8QFzAAAAABJRU5ErkJggg=='

export const parseSkinAssetDeclaration = (
	value: unknown,
): SkinAssetDeclaration => {
	const result = skinAssetDeclarationSchema(value)
	if (result instanceof ArkErrors) {
		throw new Error(`装扮资产声明格式不正确：${result.summary}`)
	}
	return result
}

// ============================================================
// 磁盘加载 + 内存缓存
// ============================================================

const appSkinCache = new Map<string, AppSkin | null>()

/** 从磁盘加载完整资产并构建 AppSkin（有内存缓存） */
export const loadSkinAssets = async (
	meta: InstalledSkinMeta,
): Promise<SkinAssetDeclaration | null> => {
	const { File, Directory } = await import('expo-file-system')
	const file = new File(new Directory(meta.rootUri), 'assets.json')
	if (!file.exists) return null
	const text = await file.text()
	return parseSkinAssetDeclaration(JSON.parse(text))
}

/**
 * 从磁盘加载完整 InstalledSkin（含 localAssets + thumbUpFrames），
 * 然后调用 buildAppSkin 构建运行时皮肤对象。
 * 结果会缓存在内存中，调用 invalidateSkinCache 可清除。
 */
export const loadActiveSkin = async (
	meta: InstalledSkinMeta,
	skinIndex = 0,
	playIconIndex = 0,
	thumbUpIndex = 0,
): Promise<AppSkin | null> => {
	const cacheKey = `${meta.id}:${skinIndex}:${playIconIndex}:${thumbUpIndex}`
	const cached = appSkinCache.get(cacheKey)
	if (cached !== undefined) return cached

	const assets = await loadSkinAssets(meta)
	if (!assets) {
		appSkinCache.set(cacheKey, null)
		return null
	}

	const skin: InstalledSkin = {
		...meta,
		localAssets: assets,
		packageDirectories: undefined,
		thumbUpFrames: undefined,
	}

	const appSkin = buildAppSkin(skin, skinIndex, playIconIndex, thumbUpIndex)
	appSkinCache.set(cacheKey, appSkin)
	return appSkin
}

/** 清除指定皮肤的缓存（卸载或更换皮肤后调用） */
export const invalidateSkinCache = (skinId: string) => {
	for (const key of appSkinCache.keys()) {
		if (key.startsWith(`${skinId}:`)) appSkinCache.delete(key)
	}
}

export const createSkinAssetFeatures = (
	assets: SkinAssetDeclaration,
): SkinAssetFeatures => ({
	avatarFrames: assets.avatar_frames.length > 0,
	cardBackgrounds: assets.card_backgrounds.length > 0,
	cards: assets.cards.length > 0,
	loadings: assets.loadings.length > 0,
	playIcons: assets.play_icons.length > 0,
	skins: assets.skins.length > 0,
	spaceBackgrounds: assets.space_backgrounds.length > 0,
	thumbups: assets.thumbups.length > 0,
})

export const skinImageSource = (resource: SkinImageResource) => ({
	scale: resource.scale ?? 1,
	uri: resource.uri,
})

export const skinRelativeUri = (
	skin: Pick<InstalledSkin, 'rootUri'>,
	path: string | null | undefined,
) => {
	if (!path) return null
	if (/^(data|file|https?):\/\//.test(path)) return path
	return `${skin.rootUri.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

const firstUri = (
	skin: Pick<InstalledSkin, 'rootUri'>,
	...paths: Array<string | null | undefined>
) => {
	for (const path of paths) {
		const uri = skinRelativeUri(skin, path)
		if (uri) return uri
	}
	return null
}

const imageResource = (uri: string | null): SkinImageResource => ({
	uri: uri ?? TRANSPARENT_PIXEL,
})

const bootSplashItemsFromCards = (
	skin: InstalledSkin,
	cards: SkinCardAsset[],
): SkinBootSplashAsset[] =>
	cards.map((card, index) => ({
		id: `card-${String(card.type_id)}-${index}`,
		name: card.name,
		card: imageResource(skinRelativeUri(skin, card.img)),
		video:
			card.video_list && card.video_list.length > 0
				? imageResource(skinRelativeUri(skin, card.video_list[0]))
				: null,
	}))

const bootSplashItemsFromSpaceBackgrounds = (
	skin: InstalledSkin,
): SkinBootSplashAsset[] =>
	skin.localAssets.space_backgrounds.flatMap((background) =>
		background.images.flatMap((image, index) => {
			const cardUri = skinRelativeUri(skin, image.portrait ?? image.landscape)
			if (!cardUri) return []
			return {
				id: `space-${background.id}-${index}`,
				name: `${background.name} ${index + 1}`,
				card: imageResource(cardUri),
				video: null,
			}
		}),
	)

export const buildAppSkin = (
	skin: InstalledSkin,
	skinIndex = 0,
	playIconIndex = 0,
	thumbUpIndex = 0,
): AppSkin | null => {
	const assets = skin.localAssets
	const themeSkin = assets.skins[skinIndex] ?? null
	const playIcon = assets.play_icons[playIconIndex] ?? null
	const thumbUp = assets.thumbups[thumbUpIndex] ?? null
	const thumbUpFrames = skin.thumbUpFrames?.[thumbUpIndex] ?? null
	const fallbackUri = firstUri(
		skin,
		themeSkin?.image_cover,
		themeSkin?.image_preview,
		assets.cards[0]?.img,
	)
	const headUri = firstUri(
		skin,
		themeSkin?.head_bg,
		themeSkin?.head_tab_bg,
		themeSkin?.image_cover,
		fallbackUri,
	)
	const normalThumbUri = firstUri(
		skin,
		playIcon?.static_icon_image,
		playIcon?.squared_image,
		playIcon?.middle_png,
		fallbackUri,
	)
	const defaultHomeUri = firstUri(
		skin,
		themeSkin?.tail_icon_main,
		themeSkin?.tail_icon_selected_main,
		fallbackUri,
	)
	const selectedHomeUri = firstUri(
		skin,
		themeSkin?.tail_icon_selected_main,
		themeSkin?.tail_icon_main,
		fallbackUri,
	)
	const defaultLibraryUri = firstUri(
		skin,
		themeSkin?.tail_icon_channel,
		themeSkin?.tail_icon_dynamic,
		themeSkin?.tail_icon_selected_channel,
		fallbackUri,
	)
	const selectedLibraryUri = firstUri(
		skin,
		themeSkin?.tail_icon_selected_channel,
		themeSkin?.tail_icon_selected_dynamic,
		themeSkin?.tail_icon_channel,
		fallbackUri,
	)
	const defaultSettingsUri = firstUri(
		skin,
		themeSkin?.tail_icon_myself,
		themeSkin?.tail_icon_shop,
		themeSkin?.tail_icon_selected_myself,
		fallbackUri,
	)
	const selectedSettingsUri = firstUri(
		skin,
		themeSkin?.tail_icon_selected_myself,
		themeSkin?.tail_icon_selected_shop,
		themeSkin?.tail_icon_myself,
		fallbackUri,
	)
	const bootSplashItems = [
		...bootSplashItemsFromCards(skin, assets.cards),
		...bootSplashItemsFromSpaceBackgrounds(skin),
	]

	if (!headUri && !normalThumbUri && bootSplashItems.length === 0) {
		return null
	}

	return {
		background: {
			head: imageResource(headUri),
		},
		bootSplash: {
			items:
				bootSplashItems.length > 0
					? bootSplashItems
					: [
							{
								card: imageResource(headUri ?? fallbackUri),
								id: 'fallback',
								name: skin.name,
								video: null,
							},
						],
		},
		colors: {
			color: themeSkin?.color ?? null,
			colorMode: themeSkin?.color_mode ?? null,
			colorSecondPage: themeSkin?.color_second_page ?? null,
			tailColor: themeSkin?.tail_color ?? null,
			tailColorSelected: themeSkin?.tail_color_selected ?? null,
		},
		id: skin.id,
		name: skin.name,
		player: {
			sliderThumb: {
				dragLeft: imageResource(
					firstUri(skin, playIcon?.drag_left_png, normalThumbUri),
				),
				dragRight: imageResource(
					firstUri(skin, playIcon?.drag_right_png, normalThumbUri),
				),
				normal: imageResource(normalThumbUri),
			},
			thumbUp: thumbUp
				? {
						frames: thumbUpFrames
							? {
									...thumbUpFrames,
									directoryUri:
										skinRelativeUri(skin, thumbUpFrames.directoryPath) ??
										thumbUpFrames.directoryPath,
								}
							: null,
						preview: thumbUp.preview
							? imageResource(skinRelativeUri(skin, thumbUp.preview))
							: null,
					}
				: null,
		},
		tabBar: {
			background: themeSkin?.tail_bg
				? imageResource(skinRelativeUri(skin, themeSkin.tail_bg))
				: null,
			icons: {
				home: {
					default: imageResource(defaultHomeUri),
					selected: imageResource(selectedHomeUri),
				},
				library: {
					default: imageResource(defaultLibraryUri),
					selected: imageResource(selectedLibraryUri),
				},
				settings: {
					default: imageResource(defaultSettingsUri),
					selected: imageResource(selectedSettingsUri),
				},
			},
		},
	}
}
