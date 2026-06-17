import { File } from 'expo-file-system'

import log from '@/utils/log'

import type { SkinAssetDeclaration } from './schema'
import type { AppSkin, InstalledSkin, InstalledSkinMeta } from './types'

const appSkinCache = new Map<string, AppSkin | null>()

const toAbsolute = (rootUri: string, path: string | null): string | null => {
	if (!path) return null
	if (/^(file|https?):\/\//.test(path)) return path
	return `${rootUri.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

const resolveAppSkinUris = (appSkin: AppSkin, rootUri: string): AppSkin => ({
	...appSkin,
	skins: appSkin.skins.map((s) => ({
		background: { head: toAbsolute(rootUri, s.background.head) },
		tabBar: {
			background: toAbsolute(rootUri, s.tabBar.background),
			icons: {
				home: {
					default: toAbsolute(rootUri, s.tabBar.icons.home.default),
					selected: toAbsolute(rootUri, s.tabBar.icons.home.selected),
				},
				library: {
					default: toAbsolute(rootUri, s.tabBar.icons.library.default),
					selected: toAbsolute(rootUri, s.tabBar.icons.library.selected),
				},
				settings: {
					default: toAbsolute(rootUri, s.tabBar.icons.settings.default),
					selected: toAbsolute(rootUri, s.tabBar.icons.settings.selected),
				},
			},
		},
		colors: s.colors,
	})),
	bootSplash: {
		items:
			appSkin.bootSplash.items?.map((item) => ({
				...item,
				card: toAbsolute(rootUri, item.card),
				video: toAbsolute(rootUri, item.video ?? null),
			})) ?? null,
	},
	loadings: appSkin.loadings.map((l) => ({
		animation: toAbsolute(rootUri, l.animation),
		frame: toAbsolute(rootUri, l.frame),
		preview: toAbsolute(rootUri, l.preview),
	})),
	sliderThumbs: appSkin.sliderThumbs.map((s) => ({
		dragLeft: toAbsolute(rootUri, s.dragLeft),
		dragRight: toAbsolute(rootUri, s.dragRight),
		normal: toAbsolute(rootUri, s.normal),
	})),
	thumbUps: appSkin.thumbUps.map((t) => ({
		animation: toAbsolute(rootUri, t.animation),
		durationMs: t.durationMs,
		preview: toAbsolute(rootUri, t.preview),
	})),
	avatarFrames: appSkin.avatarFrames
		.map((f) => toAbsolute(rootUri, f))
		.filter((f): f is string => f !== null),
	thumbUpSprites:
		appSkin.thumbUpSprites?.map((s) => ({
			...s,
			spriteSheetUri: toAbsolute(rootUri, s.spriteSheetUri) ?? s.spriteSheetUri,
		})) ?? null,
})

const loadInstalledSkin = async (
	meta: InstalledSkinMeta,
): Promise<InstalledSkin | null> => {
	const file = new File(meta.rootUri, 'skin.json')
	if (!file.exists) return null
	try {
		return JSON.parse(await file.text()) as InstalledSkin
	} catch {
		return null
	}
}

export const loadSkinAssets = async (
	meta: InstalledSkinMeta,
): Promise<SkinAssetDeclaration | null> => {
	const skin = await loadInstalledSkin(meta)
	return skin?.manifest ?? null
}

export const loadActiveSkin = async (
	meta: InstalledSkinMeta,
): Promise<AppSkin | null> => {
	const cached = appSkinCache.get(meta.id)
	if (cached !== undefined) {
		log.debug('[runtime] cache hit', { skinId: meta.id, appSkin: !!cached })
		return cached
	}

	const skin = await loadInstalledSkin(meta)
	const raw = skin?.appSkin
	if (!raw) {
		appSkinCache.set(meta.id, null)
		return null
	}

	const resolved = resolveAppSkinUris(raw, meta.rootUri)
	appSkinCache.set(meta.id, resolved)
	return resolved
}

export const invalidateSkinCache = (skinId: string) => {
	appSkinCache.delete(skinId)
}
