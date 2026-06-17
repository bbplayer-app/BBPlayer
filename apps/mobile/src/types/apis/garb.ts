/** collection 头像框 properties (part_id = 1) */
export interface BilibiliGarbAvatarFrameProperties {
	image?: string
}

/** collection/suit 动态点赞 properties (part_id = 3) */
export interface BilibiliGarbThumbUpProperties {
	image_ani?: string
	image_ani_cut?: string
	image_preview?: string
}

/**
 * collection/suit 个性主题/空间背景/动效 properties (part_id = 9)
 */
export interface BilibiliGarbThemeSkinProperties {
	color?: string
	color_mode?: string
	color_second_page?: string
	head_bg?: string
	head_myself_bg?: string
	head_myself_mp4_bg?: string
	head_myself_squared_bg?: string
	head_tab_bg?: string
	image_cover?: string
	image_preview?: string
	package_md5?: string
	package_url?: string
	side_bg?: string
	side_bg_bottom?: string
	tail_bg?: string
	tail_color?: string
	tail_color_selected?: string
	tail_icon_ani?: string
	tail_icon_channel?: string
	tail_icon_dynamic?: string
	tail_icon_main?: string
	tail_icon_myself?: string
	tail_icon_pub_btn_bg?: string
	tail_icon_selected_channel?: string
	tail_icon_selected_dynamic?: string
	tail_icon_selected_main?: string
	tail_icon_selected_myself?: string
	tail_icon_selected_pub_btn_bg?: string
	tail_icon_selected_shop?: string
	tail_icon_shop?: string
}

/** collection/suit 加载动画 properties (part_id = 10) */
export interface BilibiliGarbLoadingProperties {
	loading_frame_url?: string
	loading_url?: string
	image_preview_small?: string
}

/** collection/suit 播放图标/进度条 properties (part_id = 11) */
export interface BilibiliGarbPlayIconProperties {
	drag_left_png?: string
	drag_right_png?: string
	middle_png?: string
	squared_image?: string
	static_icon_image?: string
}

/** suit 装扮卡牌 properties */
export interface BilibiliGarbSuitCardProperties {
	image?: string
}

/** suit 装扮卡牌背景 properties */
export interface BilibiliGarbSuitCardBgProperties {
	image?: string
	image_preview_small?: string
}

/** suit 个人空间背景 properties (支持 image1_landscape/portrait 到 image8_landscape/portrait 等动态 key) */
type SpaceBgDynamicKeys = `image${number}_${'landscape' | 'portrait'}`
export type BilibiliGarbSuitSpaceBgProperties = Partial<
	Record<SpaceBgDynamicKeys, string>
>

// ============================================================
// Suit Details 组件条目具体定义
// ============================================================

type SuitItemObject<TProperties> = {
	properties: TProperties
	item_id: number
	name: string
}

/** suit/detail API 强类型返回 */
export interface BilibiliGarbSuitDetailResponse {
	item_id: number
	name: string
	suit_items: {
		card?: SuitItemObject<BilibiliGarbSuitCardProperties>[]
		card_bg?: SuitItemObject<BilibiliGarbSuitCardBgProperties>[]
		loading?: SuitItemObject<BilibiliGarbLoadingProperties>[]
		play_icon?: SuitItemObject<BilibiliGarbPlayIconProperties>[]
		skin?: SuitItemObject<BilibiliGarbThemeSkinProperties>[]
		space_bg?: SuitItemObject<BilibiliGarbSuitSpaceBgProperties>[]
		thumbup?: SuitItemObject<BilibiliGarbThumbUpProperties>[]
	}
}

// ============================================================
// 收藏集 Benefit API
// ============================================================

export interface BilibiliGarbBenefitBase {
	item_id: number
	name: string
}

export interface BilibiliGarbBenefitAvatarFrame extends BilibiliGarbBenefitBase {
	part_id: 1
	properties?: BilibiliGarbAvatarFrameProperties
}

export interface BilibiliGarbBenefitThumbUp extends BilibiliGarbBenefitBase {
	part_id: 3
	properties?: BilibiliGarbThumbUpProperties
}

export interface BilibiliGarbBenefitThemeSkin extends BilibiliGarbBenefitBase {
	part_id: 9
	properties?: BilibiliGarbThemeSkinProperties
}

export interface BilibiliGarbBenefitLoading extends BilibiliGarbBenefitBase {
	part_id: 10
	properties?: BilibiliGarbLoadingProperties
}

export interface BilibiliGarbBenefitPlayIcon extends BilibiliGarbBenefitBase {
	part_id: 11
	properties?: BilibiliGarbPlayIconProperties
}

export type BilibiliGarbBenefitResponse =
	| BilibiliGarbBenefitAvatarFrame
	| BilibiliGarbBenefitThumbUp
	| BilibiliGarbBenefitThemeSkin
	| BilibiliGarbBenefitLoading
	| BilibiliGarbBenefitPlayIcon
