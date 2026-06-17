import log from '@/utils/log'

import type { SkinAssetDeclaration } from './schema'
import type { ThumbUpSpriteResult } from './thumbUpConverter'
import type { AppSkin, InstalledSkin, SkinBootSplashAsset } from './types'

const resource = (
	url: string | null,
	mapping: Record<string, string>,
): string | null => {
	if (!url) return null
	return mapping[url] ?? url
}

const bootSplashItems = (
	cards: SkinAssetDeclaration['cards'],
	mapping: Record<string, string>,
): SkinBootSplashAsset[] =>
	cards.map((card, index) => ({
		id: `card-${String(card.type_id)}-${index}`,
		name: card.name,
		card: resource(card.img, mapping),
		video:
			card.video_list && card.video_list.length > 0
				? resource(card.video_list[0], mapping)
				: null,
	}))

export interface TransformOptions {
	manifest: SkinAssetDeclaration
	mapping: Record<string, string>
	rootUri: string
	skinId: string
	source: InstalledSkin['source']
	thumbUpSprites: ThumbUpSpriteResult[]
}

export const transformManifestToInstalledSkin = ({
	manifest,
	mapping,
	rootUri,
	skinId,
	source,
	thumbUpSprites,
}: TransformOptions): InstalledSkin => {
	log.debug('[transform] building InstalledSkin', {
		cards: manifest.cards.length,
		skins: manifest.skins.length,
		thumbups: manifest.thumbups.length,
		skinId,
	})
	const appSkin: AppSkin = {
		skins: manifest.skins.map((skin) => ({
			background: {
				head: resource(skin.head_bg, mapping),
			},
			tabBar: {
				background: resource(skin.tail_bg, mapping),
				icons: {
					home: {
						default: resource(skin.tail_icon_main, mapping),
						selected: resource(skin.tail_icon_selected_main, mapping),
					},
					library: {
						default: resource(skin.tail_icon_channel, mapping),
						selected: resource(skin.tail_icon_selected_channel, mapping),
					},
					settings: {
						default: resource(skin.tail_icon_myself, mapping),
						selected: resource(skin.tail_icon_selected_myself, mapping),
					},
				},
			},
			colors: {
				color: skin.color ?? null,
				colorMode: skin.color_mode ?? null,
				colorSecondPage: skin.color_second_page ?? null,
				tailColor: skin.tail_color ?? null,
				tailColorSelected: skin.tail_color_selected ?? null,
			},
		})),
		bootSplash: {
			items:
				manifest.cards.length > 0
					? bootSplashItems(manifest.cards, mapping)
					: null,
		},
		id: skinId,
		loadings: manifest.loadings.map((l) => ({
			animation: resource(l.loading_url, mapping),
			frame: resource(l.loading_frame_url, mapping),
			preview: resource(l.preview, mapping),
		})),
		name: manifest.name,
		sliderThumbs: manifest.play_icons.map((p) => ({
			dragLeft: resource(p.drag_left_png, mapping),
			dragRight: resource(p.drag_right_png, mapping),
			normal: resource(p.middle_png, mapping),
		})),
		thumbUps: manifest.thumbups.map((t) => ({
			animation: resource(t.ani_file, mapping),
			durationMs: null,
			preview: resource(t.preview, mapping),
		})),
		avatarFrames: manifest.avatar_frames
			.map((f) => resource(f.image, mapping))
			.filter((r): r is string => r !== null),
		thumbUpSprites:
			thumbUpSprites.length > 0
				? thumbUpSprites.map((s) => ({
						spriteSheetUri: s.spriteSheetUri,
						frameCount: s.frameCount,
						fps: s.fps,
						frameWidth: s.frameWidth,
						frameHeight: s.frameHeight,
					}))
				: null,
	}

	const coverUrl = manifest.coverUri

	return {
		appSkin,
		coverPath: coverUrl ? (mapping[coverUrl] ?? coverUrl) : null,
		id: skinId,
		installedAt: Date.now(),
		manifest,
		name: manifest.name,
		rootUri,
		source,
	}
}
