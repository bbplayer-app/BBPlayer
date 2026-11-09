import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	isSharedValue,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnUI } from 'react-native-worklets'

import type { WavySliderProps } from './ExpoWavySlider.types'

const TRACK_HEIGHT = 4
const THUMB_SIZE = 16
const DEFAULT_ACTIVE_COLOR = '#fb7299'
const DEFAULT_INACTIVE_COLOR = 'rgba(127,127,127,0.3)'

/**
 * iOS has no Compose slider, so this draws a plain track and thumb.
 *
 * It accepts the Android props and ignores the wave and skin ones. Callbacks are
 * worklets, so they are dispatched to the UI runtime to match Android.
 */
export default function WavySlider({
	progress,
	onValueChange,
	onValueChangeFinished,
	onDragStateChange,
	value = 0,
	min = 0,
	max = 1,
	enabled = true,
	colors,
	style,
}: WavySliderProps) {
	const range = max - min || 1
	const sharedProgress = isSharedValue<number>(progress) ? progress : undefined
	const trackWidth = useSharedValue(0)
	const dragging = useSharedValue(false)
	const dragFraction = useSharedValue(0)
	const gesture = useRef({ startX: 0, startPageX: 0, lastValue: value })

	const updateDrag = (x: number) => {
		const width = trackWidth.get()
		const fraction = width > 0 ? Math.min(Math.max(x / width, 0), 1) : 0
		const next = min + fraction * range
		gesture.current.lastValue = next
		dragFraction.set(fraction)
		if (onValueChange) scheduleOnUI(onValueChange, next)
	}

	const finishDrag = () => {
		dragging.set(false)
		if (onValueChangeFinished) {
			scheduleOnUI(onValueChangeFinished, gesture.current.lastValue)
		}
		if (onDragStateChange) scheduleOnUI(onDragStateChange, false)
	}

	const fraction = useDerivedValue(() => {
		if (dragging.value) return dragFraction.value
		const current = sharedProgress ? sharedProgress.value : value
		return Math.min(Math.max((current - min) / range, 0), 1)
	})

	const activeStyle = useAnimatedStyle(() => ({
		width: fraction.value * trackWidth.value,
	}))
	const thumbStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: fraction.value * trackWidth.value - THUMB_SIZE / 2 },
			{ scale: dragging.value ? 1.25 : 1 },
		],
	}))

	const activeColor = colors?.activeTrackColor ?? DEFAULT_ACTIVE_COLOR

	return (
		<View
			style={[styles.container, style]}
			onLayout={(event) => {
				trackWidth.set(event.nativeEvent.layout.width)
			}}
			onStartShouldSetResponder={() => enabled}
			onMoveShouldSetResponder={() => enabled}
			onResponderTerminationRequest={() => false}
			onResponderGrant={(event) => {
				gesture.current.startX = event.nativeEvent.locationX
				gesture.current.startPageX = event.nativeEvent.pageX
				dragging.set(true)
				if (onDragStateChange) scheduleOnUI(onDragStateChange, true)
				updateDrag(event.nativeEvent.locationX)
			}}
			onResponderMove={(event) => {
				updateDrag(
					gesture.current.startX +
						event.nativeEvent.pageX -
						gesture.current.startPageX,
				)
			}}
			onResponderRelease={finishDrag}
			onResponderTerminate={finishDrag}
		>
			<View
				pointerEvents='none'
				style={[
					styles.track,
					{
						backgroundColor:
							colors?.inactiveTrackColor ?? DEFAULT_INACTIVE_COLOR,
					},
				]}
			>
				<Animated.View
					style={[styles.active, { backgroundColor: activeColor }, activeStyle]}
				/>
			</View>
			<Animated.View
				pointerEvents='none'
				style={[
					styles.thumb,
					{ backgroundColor: colors?.thumbColor ?? activeColor },
					thumbStyle,
				]}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		justifyContent: 'center',
		minHeight: 28,
	},
	track: {
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		overflow: 'hidden',
	},
	active: {
		height: TRACK_HEIGHT,
	},
	thumb: {
		position: 'absolute',
		left: 0,
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: THUMB_SIZE / 2,
	},
})
