import type { ImageSourcePropType } from 'react-native'

export type SkinId = string

export interface SkinImageSource {
	uri: string
	scale?: number
}

export interface InstalledSkinBootSplashAsset {
	id: string
	name: string
	cardPath: string
	videoPath?: string | null
}

export interface SkinAssetFeatures {
	cards: boolean
	redeems: boolean
	skin: boolean
	playIcon: boolean
	loading: boolean
	emojiPackage: boolean
	thumbup: boolean
	spaceBg: boolean
	card: boolean
	cardBg: boolean
}

export interface InstalledSkin {
	id: SkinId
	name: string
	rootUri: string
	coverUri?: string | null
	downloadedAt: number
	assetManifestPath?: string
	assetFeatures?: SkinAssetFeatures
	bootSplashAssets?: InstalledSkinBootSplashAsset[]
	thumbUpFrameCount?: number
	thumbUpFrameFps?: number
	thumbUpFrameSize?: number
}

export interface AppSkin {
	id: SkinId
	name: string
	rootUri: string
	coverUri?: string | null
	tabBar: {
		background: SkinImageSource
		labelColor: string
		labelSelectedColor: string
		icons: {
			home: { default: SkinImageSource; selected: SkinImageSource }
			library: { default: SkinImageSource; selected: SkinImageSource }
			settings: { default: SkinImageSource; selected: SkinImageSource }
		}
	}
	player: {
		sliderThumb: {
			normal: SkinImageSource
			dragLeft: SkinImageSource
			dragRight: SkinImageSource
			preview: SkinImageSource
			offsetX?: number
			offsetY?: number
		}
		thumbUp: {
			svgaBin: SkinImageSource
			preview: SkinImageSource
			frames: {
				directoryUri: string
				count: number
				fps: number
				size: number
			}
		}
	}
	background: {
		head: SkinImageSource
		headTab: SkinImageSource
		tail: SkinImageSource
	}
	refresh: {
		frameStrip: SkinImageSource
		preview: SkinImageSource
	}
	bootSplash: {
		card: SkinImageSource
		video: SkinImageSource | null
		items: SkinBootSplashAsset[]
	}
}

export interface SkinBootSplashAsset {
	id: string
	name: string
	card: SkinImageSource
	video: SkinImageSource | null
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const skinUri = (rootUri: string, path: string): string => {
	if (/^(file|https?):\/\//.test(path)) return path
	return `${trimTrailingSlash(rootUri)}/${path.replace(/^\/+/, '')}`
}

const source = (
	rootUri: string,
	path: string,
	scale?: number,
): SkinImageSource => ({
	uri: skinUri(rootUri, path),
	scale,
})

const defaultBootSplashAssets = (rootUri: string): SkinBootSplashAsset[] => [
	{
		id: 'default',
		name: '默认海报',
		card: source(rootUri, 'splash/card.png'),
		video: null,
	},
]

const createBootSplashAssets = (skin: InstalledSkin): SkinBootSplashAsset[] => {
	const assets = skin.bootSplashAssets?.map((item) => ({
		id: item.id,
		name: item.name,
		card: source(skin.rootUri, item.cardPath),
		video: item.videoPath ? source(skin.rootUri, item.videoPath) : null,
	}))

	return assets && assets.length > 0
		? assets
		: defaultBootSplashAssets(skin.rootUri)
}

export function createAppSkinFromInstalledSkin(skin: InstalledSkin): AppSkin {
	const bootSplashItems = createBootSplashAssets(skin)
	const firstBootSplashItem = bootSplashItems[0]

	return {
		id: skin.id,
		name: skin.name,
		rootUri: trimTrailingSlash(skin.rootUri),
		coverUri: skin.coverUri ?? null,
		tabBar: {
			background: source(skin.rootUri, 'skin/tail_bg.png'),
			labelColor: '#FFFFFF',
			labelSelectedColor: '#FFFFFF',
			icons: {
				home: {
					default: source(skin.rootUri, 'skin/tail_icon_main.png', 3),
					selected: source(skin.rootUri, 'skin/tail_icon_selected_main.png', 3),
				},
				library: {
					default: source(skin.rootUri, 'skin/tail_icon_channel.png', 3),
					selected: source(
						skin.rootUri,
						'skin/tail_icon_selected_channel.png',
						3,
					),
				},
				settings: {
					default: source(skin.rootUri, 'skin/tail_icon_myself.png', 3),
					selected: source(
						skin.rootUri,
						'skin/tail_icon_selected_myself.png',
						3,
					),
				},
			},
		},
		player: {
			sliderThumb: {
				normal: source(skin.rootUri, 'play_icon/middle.png'),
				dragLeft: source(skin.rootUri, 'play_icon/drag_left.png'),
				dragRight: source(skin.rootUri, 'play_icon/drag_right.png'),
				preview: source(skin.rootUri, 'play_icon/static_icon_image.png'),
				offsetX: 0,
				offsetY: 0,
			},
			thumbUp: {
				svgaBin: source(skin.rootUri, 'thumbup/image_ani.bin'),
				preview: source(skin.rootUri, 'thumbup/image_preview.png'),
				frames: {
					directoryUri: skinUri(skin.rootUri, 'thumbup/frames'),
					count: skin.thumbUpFrameCount ?? 50,
					fps: skin.thumbUpFrameFps ?? 20,
					size: skin.thumbUpFrameSize ?? 360,
				},
			},
		},
		background: {
			head: source(skin.rootUri, 'skin/head_bg.jpg'),
			headTab: source(skin.rootUri, 'skin/head_tab_bg.png'),
			tail: source(skin.rootUri, 'skin/tail_bg.png'),
		},
		refresh: {
			frameStrip: source(skin.rootUri, 'loading/loading_frame.png'),
			preview: source(skin.rootUri, 'loading/loading.png'),
		},
		bootSplash: {
			card: firstBootSplashItem.card,
			video: firstBootSplashItem.video,
			items: bootSplashItems,
		},
	}
}

export function getSkin(
	installedSkins: InstalledSkin[],
	id: string | null | undefined,
): AppSkin | null {
	if (!id) return null

	const installedSkin = installedSkins.find((skin) => skin.id === id)
	return installedSkin ? createAppSkinFromInstalledSkin(installedSkin) : null
}

export function skinImageSource(
	sourceValue: SkinImageSource,
): ImageSourcePropType {
	return sourceValue
}
