import { err, ok, type Result } from 'neverthrow'

import { ServiceError } from '@/lib/errors'
import { createSkinTransformFailed } from '@/lib/errors/service'
import log from '@/utils/log'

import type { SkinAssetDeclaration } from './schema'
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
}

export const transformManifestToInstalledSkin = ({
	manifest,
	mapping,
	rootUri,
	skinId,
	source,
}: TransformOptions): Result<InstalledSkin, ServiceError> => {
	const result = doTransform({ manifest, mapping, rootUri, skinId, source })
	if (result.isErr()) return result
	log.debug('[transform] built InstalledSkin', {
		cards: manifest.cards.length,
		skins: manifest.skins.length,
		thumbups: manifest.thumbups.length,
		skinId,
	})
	return ok(result.value)
}

const doTransform = ({
	manifest,
	mapping,
	rootUri,
	skinId,
	source,
}: TransformOptions): Result<InstalledSkin, ServiceError> => {
	try {
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
		}

		const coverUrl = manifest.coverUri

		return ok({
			appSkin,
			coverPath: coverUrl ? (mapping[coverUrl] ?? coverUrl) : null,
			id: skinId,
			installedAt: Date.now(),
			manifest,
			name: manifest.name,
			rootUri,
			source,
		})
	} catch (e) {
		return err(
			createSkinTransformFailed(e instanceof Error ? e.message : String(e), e),
		)
	}
}
