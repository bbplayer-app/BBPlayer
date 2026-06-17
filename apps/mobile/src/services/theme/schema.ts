import { ArkErrors, type as arkType } from 'arktype'

// ============================================================
// Helpers
// ============================================================

const nullableString = 'string | null = null'

// ============================================================
// Leaf asset schemas (8 total — all composed into UnifiedAssetManifest)
// ============================================================

export const cardAssetSchema = arkType({
	name: 'string',
	type_id: 'number | string',
	img: 'string',
	video_list: 'string[] | null = null',
})

export const avatarFrameAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	image: nullableString,
})

export const thumbUpAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	ani_file: nullableString,
	ani_cut: nullableString,
	preview: nullableString,
})

export const skinAssetSchema = arkType({
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

export const loadingAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	loading_url: nullableString,
	loading_frame_url: nullableString,
	preview: nullableString,
})

export const playIconAssetSchema = arkType({
	id: 'number',
	name: nullableString,
	drag_left_png: nullableString,
	drag_right_png: nullableString,
	middle_png: nullableString,
	static_icon_image: nullableString,
	squared_image: nullableString,
})

export const spaceBackgroundAssetSchema = arkType({
	id: 'number',
	name: 'string',
	images: arkType({
		landscape: nullableString,
		portrait: nullableString,
	}).array(),
})

export const cardBackgroundAssetSchema = arkType({
	id: 'number',
	name: 'string',
	image: nullableString,
	preview: nullableString,
})

// ============================================================
// Unified Asset Manifest (composes all 8 leaf schemas above)
// ============================================================

export const skinAssetDeclarationSchema = arkType({
	type: "'collection' | 'suit'",
	name: 'string',
	coverUri: nullableString,
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

// ============================================================
// Schema-derived types
// ============================================================

export type SkinAssetDeclaration = typeof skinAssetDeclarationSchema.infer
export type SkinCardAsset = typeof cardAssetSchema.infer
export type SkinAsset = typeof skinAssetSchema.infer
export type SkinPlayIconAsset = typeof playIconAssetSchema.infer
export type SkinThumbUpAsset = typeof thumbUpAssetSchema.infer
export type SkinLoadingAsset = typeof loadingAssetSchema.infer

// ============================================================
// Validation
// ============================================================

export const parseSkinAssetDeclaration = (
	value: unknown,
): SkinAssetDeclaration => {
	const result = skinAssetDeclarationSchema(value)
	if (result instanceof ArkErrors) {
		throw new Error(`装扮资产声明格式不正确：${result.summary}`)
	}
	return result
}
