import { ArkErrors, type as arkType } from 'arktype'
import { Directory, File } from 'expo-file-system'

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

export interface InstalledSkinThumbUpGif {
	durationMs: number
	path: string
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
	thumbUpGifs?: Array<InstalledSkinThumbUpGif | null>
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
	card: SkinImageResource | null
	id: string
	name: string
	video?: SkinImageResource | null
}

export interface AppSkin {
	background: {
		head: SkinImageResource | null
	}
	bootSplash: {
		items: SkinBootSplashAsset[] | null
	}
	colors: {
		color: string | null
		colorMode: string | null
		colorSecondPage: string | null
		tailColor: string | null
		tailColorSelected: string | null
	}
	id: string
	loading: {
		animation: SkinImageResource | null
		frame: SkinImageResource | null
		preview: SkinImageResource | null
	} | null
	name: string
	player: {
		sliderThumb: {
			dragLeft: SkinImageResource | null
			dragRight: SkinImageResource | null
			normal: SkinImageResource | null
		}
		thumbUp: {
			animation: SkinImageResource | null
			durationMs: number | null
			preview: SkinImageResource | null
		} | null
	}
	profile: {
		avatarFrame: SkinImageResource | null
	}
	tabBar: {
		background: SkinImageResource | null
		icons: {
			home: {
				default: SkinImageResource | null
				selected: SkinImageResource | null
			}
			library: {
				default: SkinImageResource | null
				selected: SkinImageResource | null
			}
			settings: {
				default: SkinImageResource | null
				selected: SkinImageResource | null
			}
		}
	}
}

const itemAt = <T>(items: readonly T[], index: number): T | null =>
	index >= 0 && index < items.length ? (items[index] ?? null) : null

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

const isInstalledSkinThumbUpGif = (
	value: unknown,
): value is InstalledSkinThumbUpGif => {
	if (!isRecord(value)) return false
	return typeof value.durationMs === 'number' && typeof value.path === 'string'
}

interface InstalledSkinFileData {
	localAssets: SkinAssetDeclaration
	thumbUpGifs: Array<InstalledSkinThumbUpGif | null>
}

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

const loadInstalledSkinFileData = async (
	meta: InstalledSkinMeta,
): Promise<InstalledSkinFileData | null> => {
	const file = new File(new Directory(meta.rootUri), 'installed-skin.json')
	if (!file.exists) return null

	const value = JSON.parse(await file.text()) as unknown
	if (!isRecord(value)) return null

	const thumbUpGifs = Array.isArray(value.thumbUpGifs)
		? value.thumbUpGifs.map((gif) =>
				isInstalledSkinThumbUpGif(gif) ? gif : null,
			)
		: []

	return {
		localAssets: parseSkinAssetDeclaration(value.localAssets),
		thumbUpGifs,
	}
}

/** 从磁盘加载完整资产并构建 AppSkin（有内存缓存） */
export const loadSkinAssets = async (
	meta: InstalledSkinMeta,
): Promise<SkinAssetDeclaration | null> =>
	(await loadInstalledSkinFileData(meta))?.localAssets ?? null

/**
 * 从磁盘加载完整 InstalledSkin（含 localAssets + thumbUpGifs），
 * 然后调用 buildAppSkin 构建运行时皮肤对象。
 * 结果会缓存在内存中，调用 invalidateSkinCache 可清除。
 */
export const loadActiveSkin = async (
	meta: InstalledSkinMeta,
	skinIndex = 0,
	playIconIndex = 0,
	thumbUpIndex = 0,
	avatarFrameIndex = 0,
	loadingIndex = 0,
): Promise<AppSkin | null> => {
	const cacheKey = `${meta.id}:${skinIndex}:${playIconIndex}:${thumbUpIndex}:${avatarFrameIndex}:${loadingIndex}`
	const cached = appSkinCache.get(cacheKey)
	if (cached !== undefined) return cached

	const installedSkinFile = await loadInstalledSkinFileData(meta)
	if (!installedSkinFile) {
		appSkinCache.set(cacheKey, null)
		return null
	}

	const skin: InstalledSkin = {
		...meta,
		localAssets: installedSkinFile.localAssets,
		packageDirectories: undefined,
		thumbUpGifs: installedSkinFile.thumbUpGifs,
	}

	const appSkin = buildAppSkin(
		skin,
		skinIndex,
		playIconIndex,
		thumbUpIndex,
		avatarFrameIndex,
		loadingIndex,
	)
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

/**
 * 将相对路径转换为可以访问到的绝对路径
 */
export const skinRelativeUri = (
	skin: Pick<InstalledSkin, 'rootUri'>,
	path: string | null | undefined,
) => {
	if (!path) return null
	if (/^(data|file|https?):\/\//.test(path)) return path
	return `${skin.rootUri.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

const imageResource = (uri: string | null): SkinImageResource | null =>
	uri ? { uri } : null

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

export const buildAppSkin = (
	skin: InstalledSkin,
	skinIndex = 0,
	playIconIndex = 0,
	thumbUpIndex = 0,
	avatarFrameIndex = 0,
	loadingIndex = 0,
): AppSkin | null => {
	const assets = skin.localAssets
	const themeSkin = itemAt(assets.skins, skinIndex)
	const playIcon = itemAt(assets.play_icons, playIconIndex)
	const thumbUp = itemAt(assets.thumbups, thumbUpIndex)
	const avatarFrame = itemAt(assets.avatar_frames, avatarFrameIndex)
	const loading = itemAt(assets.loadings, loadingIndex)
	const thumbUpGif = itemAt(skin.thumbUpGifs ?? [], thumbUpIndex)
	const headUri = skinRelativeUri(skin, themeSkin?.head_bg)
	const defaultHomeUri = skinRelativeUri(skin, themeSkin?.tail_icon_main)
	const selectedHomeUri = skinRelativeUri(
		skin,
		themeSkin?.tail_icon_selected_main,
	)
	const defaultLibraryUri = skinRelativeUri(skin, themeSkin?.tail_icon_channel)
	const selectedLibraryUri = skinRelativeUri(
		skin,
		themeSkin?.tail_icon_selected_channel,
	)
	const defaultSettingsUri = skinRelativeUri(skin, themeSkin?.tail_icon_myself)
	const selectedSettingsUri = skinRelativeUri(
		skin,
		themeSkin?.tail_icon_selected_myself,
	)
	const bootSplashItems = bootSplashItemsFromCards(skin, assets.cards)

	if (
		!themeSkin &&
		!playIcon &&
		!thumbUp &&
		!avatarFrame &&
		!loading &&
		bootSplashItems.length === 0
	) {
		return null
	}

	return {
		background: {
			head: imageResource(headUri),
		},
		bootSplash: {
			items: bootSplashItems.length > 0 ? bootSplashItems : null,
		},
		colors: {
			color: themeSkin?.color ?? null,
			colorMode: themeSkin?.color_mode ?? null,
			colorSecondPage: themeSkin?.color_second_page ?? null,
			tailColor: themeSkin?.tail_color ?? null,
			tailColorSelected: themeSkin?.tail_color_selected ?? null,
		},
		id: skin.id,
		loading: loading
			? {
					animation: imageResource(skinRelativeUri(skin, loading.loading_url)),
					frame: imageResource(
						skinRelativeUri(skin, loading.loading_frame_url),
					),
					preview: imageResource(skinRelativeUri(skin, loading.preview)),
				}
			: null,
		name: skin.name,
		player: {
			sliderThumb: {
				dragLeft: imageResource(skinRelativeUri(skin, playIcon?.drag_left_png)),
				dragRight: imageResource(
					skinRelativeUri(skin, playIcon?.drag_right_png),
				),
				normal: imageResource(skinRelativeUri(skin, playIcon?.middle_png)),
			},
			thumbUp: thumbUp
				? {
						animation: imageResource(skinRelativeUri(skin, thumbUpGif?.path)),
						durationMs: thumbUpGif?.durationMs ?? null,
						preview: thumbUp.preview
							? imageResource(skinRelativeUri(skin, thumbUp.preview))
							: null,
					}
				: null,
		},
		profile: {
			avatarFrame: imageResource(skinRelativeUri(skin, avatarFrame?.image)),
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
