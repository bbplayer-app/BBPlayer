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
	shouldFlash?: boolean
}

export function FlashingTrackListItem({
	shouldFlash,
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
	}, [shouldFlash, opacity])

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
