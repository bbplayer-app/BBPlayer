import type { ComponentProps } from 'react'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from 'react-native-reanimated'

import { TrackListItem } from './PlaylistItem'

type TrackListItemProps = ComponentProps<typeof TrackListItem>

interface FlashingTrackListItemProps extends TrackListItemProps {
	/** 为 true 时闪一下，条目挂载时为 true 也会闪 */
	shouldFlash?: boolean
	/** shouldFlash 为 true 时，这个值每变一次就再闪一次，比如对同一 P 再点一次续播 */
	flashKey?: number
}

export function FlashingTrackListItem({
	shouldFlash,
	flashKey,
	...props
}: FlashingTrackListItemProps) {
	const theme = useTheme()
	const opacity = useSharedValue(0)

	const animatedStyle = useAnimatedStyle(() => {
		return {
			backgroundColor: theme.colors.primaryContainer,
			opacity: opacity.value,
		}
	})

	useEffect(() => {
		if (shouldFlash) {
			opacity.set(
				withSequence(
					withTiming(0.4, { duration: 300 }),
					withTiming(0, { duration: 300 }),
					withTiming(0.4, { duration: 300 }),
					withTiming(0, { duration: 300 }),
				),
			)
		}
	}, [shouldFlash, flashKey, opacity])

	return (
		<Animated.View style={[styles.container]}>
			<TrackListItem {...props} />
			<Animated.View
				pointerEvents='none'
				style={[StyleSheet.absoluteFill, animatedStyle]}
			/>
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'relative',
	},
})
