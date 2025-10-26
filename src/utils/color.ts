interface RGBColor {
	r: number
	g: number
	b: number
}

/**
 * HSL 颜色值转换为 RGB.
 * h (色相) 范围 [0, 360]
 * s (饱和度) 范围 [0, 1]
 * l (亮度) 范围 [0, 1]
 * @returns {RGBColor} 范围 [0, 255]
 */
function hslToRgb(h: number, s: number, l: number): RGBColor {
	let r: number, g: number, b: number

	if (s === 0) {
		r = g = b = l
	} else {
		const hue2rgb = (p: number, q: number, t: number): number => {
			if (t < 0) t += 1
			if (t > 1) t -= 1
			if (t < 1 / 6) return p + (q - p) * 6 * t
			if (t < 1 / 2) return q
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
			return p
		}

		const q: number = l < 0.5 ? l * (1 + s) : l + s - l * s
		const p: number = 2 * l - q
		const h_normalized: number = h / 360 // h 要归一化到 [0, 1]

		r = hue2rgb(p, q, h_normalized + 1 / 3)
		g = hue2rgb(p, q, h_normalized)
		b = hue2rgb(p, q, h_normalized - 1 / 3)
	}

	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255),
	}
}

/**
 * 将字符串转换为一个32位整数哈希值
 */
function stringToHashCode(str: string): number {
	let hash = 0
	if (str.length === 0) return hash
	for (let i = 0; i < str.length; i++) {
		const char: number = str.charCodeAt(i) // charCodeAt 返回的就是 number
		hash = (hash << 5) - hash + char
		hash = hash & hash // 转换为32位整数
	}
	return hash
}

/**
 * 最终的渐变色结果类型
 */
export interface GradientColors {
	color1: string
	color2: string
}

/**
 * 基于字符串生成一对渐变颜色，并自动根据是否为暗黑模式返回不同的颜色
 * @param name 字符串
 * @param isDarkMode 是否为暗黑模式
 * @returns {GradientColors} 两个 rgba 字符串
 */
export function getGradientColors(name: string, isDarkMode: boolean) {
	let saturation: number, lightness: number, lightness2: number

	if (isDarkMode) {
		saturation = 0.55
		lightness = 0.4
		lightness2 = 0.35
	} else {
		saturation = 0.7
		lightness = 0.65
		lightness2 = 0.6
	}

	const hash: number = stringToHashCode(name)
	const baseHue: number = Math.abs(hash) % 360
	const secondHue: number = (baseHue + 40) % 360 // 偏移40度

	const rgb1: RGBColor = hslToRgb(baseHue, saturation, lightness)
	const rgb2: RGBColor = hslToRgb(secondHue, saturation, lightness2)

	const color1 = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, 1)`
	const color2 = `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, 1)`

	return { color1, color2 }
}
