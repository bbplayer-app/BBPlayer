import type { ImageSourcePropType } from 'react-native'

export type SkinId = 'mygo-sunny-sky'

export interface SkinImageSource {
	uri: string
	scale?: number
}

export interface AppSkin {
	id: SkinId
	name: string
	rootUri: string
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
			gif: SkinImageSource
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

const localSkinRoot =
	'file:///sdcard/Android/data/com.roitium.bbplayer/files/bilibili_skin_exp/lottery_102857_zip'

const skinUri = (rootUri: string, path: string): string => `${rootUri}/${path}`

const bootSplashItemIds = [
	'1778726160002',
	'1778726160003',
	'1778726160004',
	'1778726160005',
	'1778726160006',
	'1778726160007',
	'1778726160008',
	'1778726160009',
	'1778726160010',
	'1778726160011',
	'1778726160012',
	'1778726160013',
	'1778726160014',
	'1778726160015',
	'1778726160016',
	'1778726160017',
	'1778726160018',
	'1778726160019',
	'1778726160020',
	'1778726160021',
	'1778726160022',
	'1778726160023',
	'1778726160024',
	'1778726160025',
	'1778726160026',
]

const bootSplashVideoItemIds = new Set([
	'1778726160002',
	'1778726160003',
	'1778726160004',
	'1778726160005',
	'1778726160006',
	'1778726160007',
	'1778726160008',
	'1778726160024',
	'1778726160025',
	'1778726160026',
])

const mygoBootSplashItems: SkinBootSplashAsset[] = bootSplashItemIds.map(
	(id, index) => ({
		id,
		name: `启动动画 ${index + 1}`,
		card: {
			uri: skinUri(localSkinRoot, `splash/items/${id}/card.png`),
		},
		video: bootSplashVideoItemIds.has(id)
			? {
					uri: skinUri(localSkinRoot, `splash/items/${id}/intro.mp4`),
				}
			: null,
	}),
)

export const mygoSunnySkySkin: AppSkin = {
	id: 'mygo-sunny-sky',
	name: 'MyGO!!!!! 晴空向光行',
	rootUri: localSkinRoot,
	tabBar: {
		background: {
			uri: skinUri(localSkinRoot, 'skin/tail_bg.png'),
		},
		labelColor: '#FFFFFF',
		labelSelectedColor: '#FFFFFF',
		icons: {
			home: {
				default: {
					uri: skinUri(localSkinRoot, 'skin/tail_icon_main.png'),
					scale: 3,
				},
				selected: {
					uri: skinUri(localSkinRoot, 'skin/tail_icon_selected_main.png'),
					scale: 3,
				},
			},
			library: {
				default: {
					uri: skinUri(localSkinRoot, 'skin/tail_icon_channel.png'),
					scale: 3,
				},
				selected: {
					uri: skinUri(localSkinRoot, 'skin/tail_icon_selected_channel.png'),
					scale: 3,
				},
			},
			settings: {
				default: {
					uri: skinUri(localSkinRoot, 'skin/tail_icon_myself.png'),
					scale: 3,
				},
				selected: {
					uri: skinUri(localSkinRoot, 'skin/tail_icon_selected_myself.png'),
					scale: 3,
				},
			},
		},
	},
	player: {
		sliderThumb: {
			normal: {
				uri: skinUri(localSkinRoot, 'play_icon/middle.png'),
			},
			dragLeft: {
				uri: skinUri(localSkinRoot, 'play_icon/drag_left.png'),
			},
			dragRight: {
				uri: skinUri(localSkinRoot, 'play_icon/drag_right.png'),
			},
			preview: {
				uri: skinUri(localSkinRoot, 'play_icon/static_icon_image.png'),
			},
			offsetX: 0,
			offsetY: 0,
		},
		thumbUp: {
			svgaBin: {
				uri: skinUri(localSkinRoot, 'thumbup/image_ani.bin'),
			},
			gif: {
				uri: skinUri(localSkinRoot, 'thumbup/image_ani.gif'),
			},
			preview: {
				uri: skinUri(localSkinRoot, 'thumbup/image_preview.png'),
			},
			frames: {
				directoryUri: skinUri(localSkinRoot, 'thumbup/frames'),
				count: 50,
				fps: 20,
				size: 360,
			},
		},
	},
	background: {
		head: {
			uri: skinUri(localSkinRoot, 'skin/head_bg.jpg'),
		},
		headTab: {
			uri: skinUri(localSkinRoot, 'skin/head_tab_bg.png'),
		},
		tail: {
			uri: skinUri(localSkinRoot, 'skin/tail_bg.png'),
		},
	},
	refresh: {
		frameStrip: {
			uri: skinUri(localSkinRoot, 'loading/loading_frame.png'),
		},
		preview: {
			uri: skinUri(localSkinRoot, 'loading/loading.png'),
		},
	},
	bootSplash: {
		card: {
			uri: mygoBootSplashItems[0].card.uri,
		},
		video: mygoBootSplashItems[0].video,
		items: mygoBootSplashItems,
	},
}

export const appSkins: Record<SkinId, AppSkin> = {
	[mygoSunnySkySkin.id]: mygoSunnySkySkin,
}

export function getSkin(id: string | null | undefined): AppSkin | null {
	if (!id) return null
	return appSkins[id as SkinId] ?? null
}

export function skinImageSource(source: SkinImageSource): ImageSourcePropType {
	return source
}
