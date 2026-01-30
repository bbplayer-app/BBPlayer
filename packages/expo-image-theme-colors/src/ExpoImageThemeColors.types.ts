/**
 * 代表一个 swatch 的所有信息
 */
export interface ColorInfo {
	/** 颜色的 6 位 Hex 值 (e.g., "#FF0000") */
	hex: string

	/** 推荐的标题文本颜色 (e.g., "#FFFFFF") */
	titleTextColor: string

	/** 推荐的正文文本颜色 (e.g., "#000000") */
	bodyTextColor: string

	/** 这个颜色在图片中占了多少像素点 */
	population: number
}

type SwatchName =
	| 'dominant'
	| 'vibrant'
	| 'lightVibrant'
	| 'darkVibrant'
	| 'muted'
	| 'lightMuted'
	| 'darkMuted'

type PaletteSwatches = Record<SwatchName, ColorInfo | null>

export type ExtractedPalette = {
	/** 图片宽度 (px) */
	width: number
	/** 图片高度 (px) */
	height: number
} & PaletteSwatches
