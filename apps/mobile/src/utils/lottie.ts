import { type AnimationObject } from 'lottie-react-native'

/**
 * 将十六进制颜色替换 Lottie JSON 中的白色占位符 [1,1,1,1]。
 */
export function tintLottieSource(
	source: AnimationObject,
	hexColor: string,
): AnimationObject {
	const hex = hexColor.replace('#', '')
	const r = (parseInt(hex.slice(0, 2), 16) / 255).toFixed(4)
	const g = (parseInt(hex.slice(2, 4), 16) / 255).toFixed(4)
	const b = (parseInt(hex.slice(4, 6), 16) / 255).toFixed(4)
	return JSON.parse(
		JSON.stringify(source).replace(/\[1,1,1,1\]/g, `[${r},${g},${b},1]`),
	) as AnimationObject
}
