import type { SkinAssetDeclaration } from './schema'

export type { SkinAssetDeclaration }

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

export interface InstalledSkin {
	coverPath: string | null
	id: string
	installedAt: number
	manifest: SkinAssetDeclaration
	name: string
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
	appSkin: AppSkin
}

/** Lightweight metadata stored in Zustand (excludes `localAssets`) */
export interface InstalledSkinMeta {
	coverPath: string | null
	id: string
	installedAt: number
	name: string
	rootUri: string
	source: InstalledSkin['source']
}

export interface SkinBootSplashAsset {
	card: string | null
	id: string
	name: string
	video?: string | null
}

export interface AppSkin {
	skins: {
		background: {
			head: string | null
		}
		tabBar: {
			background: string | null
			icons: {
				home: {
					default: string | null
					selected: string | null
				}
				library: {
					default: string | null
					selected: string | null
				}
				settings: {
					default: string | null
					selected: string | null
				}
			}
		}
		colors: {
			color: string | null
			colorMode: string | null
			colorSecondPage: string | null
			tailColor: string | null
			tailColorSelected: string | null
		}
	}[]
	bootSplash: {
		items: SkinBootSplashAsset[] | null
	}
	id: string
	loadings: {
		animation: string | null
		frame: string | null
		preview: string | null
	}[]
	name: string
	sliderThumbs: {
		dragLeft: string | null
		dragRight: string | null
		normal: string | null
	}[]
	thumbUps: {
		animation: string | null
		durationMs: number | null
		preview: string | null
	}[]
	avatarFrames: string[]
}

// ============================================================
// Download progress (shared between skin install & UI)
// ============================================================

export interface SkinDownloadProgress {
	completed: number
	label: string
	progress: number
	total: number
}

export const installedSkinToMeta = (
	skin: InstalledSkin,
): InstalledSkinMeta => ({
	coverPath: skin.coverPath,
	id: skin.id,
	installedAt: skin.installedAt,
	name: skin.name,
	rootUri: skin.rootUri,
	source: skin.source,
})

export const assetFeaturesFromManifest = (
	m: SkinAssetDeclaration,
): SkinAssetFeatures => ({
	avatarFrames: m.avatar_frames.length > 0,
	cardBackgrounds: m.card_backgrounds.length > 0,
	cards: m.cards.length > 0,
	loadings: m.loadings.length > 0,
	playIcons: m.play_icons.length > 0,
	skins: m.skins.length > 0,
	spaceBackgrounds: m.space_backgrounds.length > 0,
	thumbups: m.thumbups.length > 0,
})
