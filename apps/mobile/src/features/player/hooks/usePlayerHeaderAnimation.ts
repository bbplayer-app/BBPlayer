import {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

export function usePlayerHeaderAnimation(
	index: number,
	scrollX?: SharedValue<number>,
) {
	const titleStyle = useAnimatedStyle(() => {
		if (!scrollX) return { opacity: index === 1 ? 1 : 0 }
		return {
			opacity: interpolate(
				scrollX.value,
				[0.4, 1],
				[0, 1],
				Extrapolation.CLAMP,
			),
		}
	})

	const statusStyle = useAnimatedStyle(() => {
		if (!scrollX) return { opacity: index === 0 ? 1 : 0 }
		return {
			opacity: interpolate(
				scrollX.value,
				[0, 0.4],
				[1, 0],
				Extrapolation.CLAMP,
			),
		}
	})

	return {
		titleStyle,
		statusStyle,
	}
}
