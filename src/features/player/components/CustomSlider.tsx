import { useCallback, useMemo } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { I18nManager, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTheme } from 'react-native-paper'
import type { SharedValue } from 'react-native-reanimated'
import Animated, {
	runOnJS,
	useAnimatedProps,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withSpring,
} from 'react-native-reanimated'

interface CustomSliderProps {
	minimumValue?: number
	maximumValue?: number
	disabled?: boolean
	onSlidingStart?: (value: number) => void
	onSlidingComplete?: (value: number) => void
	value?: SharedValue<number>
	duration?: SharedValue<number>
}

export function CustomSlider({
	minimumValue = 0,
	maximumValue = 1,
	disabled = false,
	onSlidingStart,
	onSlidingComplete,
	value,
	duration,
}: CustomSliderProps) {
	const { colors } = useTheme()

	const containerWidth = useSharedValue(0)
	const isScrubbing = useSharedValue(false)
	const thumbScale = useSharedValue(1)
	const containerScale = useSharedValue(1)
	const internalProgress = useSharedValue(0)

	const externalProgress = useDerivedValue(() => {
		if (!value?.value || !duration?.value || duration.value <= 0) {
			return 0
		}
		return Math.min(Math.max(value.value / duration.value, 0), 1)
	})

	const displayProgress = useDerivedValue(() => {
		return isScrubbing.value ? internalProgress.value : externalProgress.value
	})

	const thumbTranslateX = useDerivedValue(() => {
		if (containerWidth.value === 0) return 0
		const progress = displayProgress.value
		const position = progress * containerWidth.value

		return I18nManager.isRTL ? containerWidth.value - position : position
	})

	const activeTrackScaleX = useDerivedValue(() => {
		return displayProgress.value
	})

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		const { width } = event.nativeEvent.layout
		if (width > 0 && containerWidth.value !== width) {
			containerWidth.value = width
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const xToProgress = useCallback((x: number) => {
		'worklet'
		if (containerWidth.value === 0) return 0

		let clampedX = Math.min(Math.max(x, 0), containerWidth.value)

		if (I18nManager.isRTL) {
			clampedX = containerWidth.value - clampedX
		}

		return clampedX / containerWidth.value
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const panGesture = useMemo(() => {
		return Gesture.Pan()
			.onBegin((event) => {
				'worklet'
				if (disabled) return

				const startProgress = xToProgress(event.absoluteX)
				const thumbX = thumbTranslateX.value
				const distance = Math.abs(event.absoluteX - thumbX)
				const isNearThumb = distance < 30

				if (isNearThumb || isScrubbing.value) {
					isScrubbing.set(true)
					internalProgress.set(startProgress)

					thumbScale.value = withSpring(1.2)
					containerScale.value = withSpring(1.02)

					if (onSlidingStart) {
						runOnJS(onSlidingStart)(startProgress * maximumValue)
					}
				}
			})
			.onUpdate((event) => {
				'worklet'
				if (disabled || !isScrubbing.value) return

				const newProgress = xToProgress(event.absoluteX)
				internalProgress.set(newProgress)
			})
			.onEnd(() => {
				'worklet'
				if (disabled || !isScrubbing.value) return

				const finalValue = internalProgress.value * maximumValue

				thumbScale.value = withSpring(1)
				containerScale.value = withSpring(1)

				if (onSlidingComplete) {
					runOnJS(onSlidingComplete)(finalValue)
				}

				runOnJS(() => {
					setTimeout(() => {
						isScrubbing.set(false)
					}, 100)
				})()
			})
	}, [disabled, maximumValue, onSlidingStart, onSlidingComplete, xToProgress]) // eslint-disable-line react-hooks/exhaustive-deps

	const tapGesture = useMemo(() => {
		return Gesture.Tap().onEnd((event) => {
			'worklet'
			if (disabled) return

			const newProgress = xToProgress(event.absoluteX)

			internalProgress.set(newProgress)

			const finalValue = newProgress * maximumValue

			if (onSlidingComplete) {
				runOnJS(onSlidingComplete)(finalValue)
			}
		})
	}, [disabled, maximumValue, onSlidingComplete, xToProgress]) // eslint-disable-line react-hooks/exhaustive-deps

	const composedGesture = useMemo(() => {
		return Gesture.Race(panGesture, tapGesture)
	}, [panGesture, tapGesture])

	const thumbStyle = useAnimatedStyle(
		() => ({
			transform: [
				{ translateX: thumbTranslateX.value },
				{ scale: thumbScale.value },
			],
			opacity: disabled ? 0.5 : 1,
		}),
		[disabled],
	)

	const activeTrackStyle = useAnimatedStyle(
		() => ({
			transform: [{ scaleX: activeTrackScaleX.value }],
			opacity: disabled ? 0.3 : 1,
		}),
		[disabled],
	)

	const containerStyle = useAnimatedStyle(
		() => ({
			transform: [{ scale: containerScale.value }],
		}),
		[],
	)

	const accessibilityLabel = useDerivedValue(() => {
		const percentage = Math.round(displayProgress.value * 100)
		return `Seek position: ${percentage}%`
	})

	const accessibilityProps = useAnimatedProps(() => ({
		accessibilityLabel: accessibilityLabel.value,
		accessibilityValue: {
			min: minimumValue,
			max: maximumValue,
			now: displayProgress.value * maximumValue,
		},
	}))

	return (
		<GestureDetector gesture={composedGesture}>
			<Animated.View
				style={[styles.container, containerStyle]}
				onLayout={handleLayout}
				accessible={true}
				accessibilityRole='adjustable'
				animatedProps={accessibilityProps}
				hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
			>
				{/* Background track */}
				<View
					style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
				/>

				<Animated.View
					style={[
						styles.activeTrack,
						activeTrackStyle,
						{ backgroundColor: colors.primary },
					]}
				/>

				<Animated.View
					style={[
						styles.thumb,
						thumbStyle,
						{ backgroundColor: colors.primary },
					]}
				/>
			</Animated.View>
		</GestureDetector>
	)
}

const styles = StyleSheet.create({
	container: {
		width: '100%',
		height: 40,
		justifyContent: 'center',
		position: 'relative',
	},
	track: {
		position: 'absolute',
		height: 4,
		width: '100%',
		borderRadius: 2,
	},
	activeTrack: {
		position: 'absolute',
		height: 4,
		width: '100%',
		borderRadius: 2,
		left: 0,
		top: 0,
		bottom: 0,
		transformOrigin: 'left',
	},
	thumb: {
		position: 'absolute',
		width: 20,
		height: 20,
		borderRadius: 10,
		top: 10,
		marginLeft: -10,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
})
