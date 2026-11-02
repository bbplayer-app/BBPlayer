import Color from 'color'
import { type AnimationObject } from 'lottie-react-native'

/**
 * 用主题色替换 Lottie JSON 中的白色占位符 [1,1,1,1]。
 * Paper 默认主题使用 rgba，动态主题使用 hex，两种格式都需要支持。
 */
export function tintLottieSource(
	source: AnimationObject,
	colorValue: string,
): AnimationObject {
	try {
		const color = Color(colorValue).rgb()
		const r = (color.red() / 255).toFixed(4)
		const g = (color.green() / 255).toFixed(4)
		const b = (color.blue() / 255).toFixed(4)
		return JSON.parse(
			JSON.stringify(source).replace(/\[1,1,1,1\]/g, `[${r},${g},${b},1]`),
		) as AnimationObject
	} catch {
		return source
	}
}
