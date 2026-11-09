import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

import type { PlaybackSpeedSliderProps } from './PlaybackSpeedSlider'

const TRACK_HEIGHT = 4
const THUMB_SIZE = 20

/** A plain React Native slider, since the SwiftUI one stalls inside this dialog. */
export default function PlaybackSpeedSlider({
	value,
	min,
	max,
	steps,
	onValueChange,
	onValueChangeFinished,
}: PlaybackSpeedSliderProps) {
	const { colors } = useTheme()
	const [width, setWidth] = useState(0)
	const gesture = useRef({ startX: 0, startPageX: 0 })
	const range = max - min
	const step = range / (steps + 1)
	const fraction = Math.min(Math.max((value - min) / range, 0), 1)

	const updateFromPosition = (x: number) => {
		if (width <= 0) return
		const ratio = Math.min(Math.max(x / width, 0), 1)
		onValueChange(min + Math.round((ratio * range) / step) * step)
	}

	const adjustByStep = (direction: number) => {
		onValueChange(Math.min(Math.max(value + direction * step, min), max))
		onValueChangeFinished()
	}

	return (
		<View
			accessible
			accessibilityRole='adjustable'
			accessibilityLabel='播放速度'
			accessibilityValue={{ text: `${value.toFixed(2)}x` }}
			accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
			onAccessibilityAction={(event) =>
				adjustByStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)
			}
			style={styles.container}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			onStartShouldSetResponder={() => true}
			onMoveShouldSetResponder={() => true}
			onResponderTerminationRequest={() => false}
			onResponderGrant={(event) => {
				gesture.current.startX = event.nativeEvent.locationX
				gesture.current.startPageX = event.nativeEvent.pageX
				updateFromPosition(event.nativeEvent.locationX)
			}}
			onResponderMove={(event) => {
				updateFromPosition(
					gesture.current.startX +
						event.nativeEvent.pageX -
						gesture.current.startPageX,
				)
			}}
			onResponderRelease={onValueChangeFinished}
			onResponderTerminate={onValueChangeFinished}
		>
			<View
				pointerEvents='none'
				style={[styles.track, { backgroundColor: colors.surfaceVariant }]}
			>
				<View
					style={[
						styles.active,
						{
							width: fraction * width,
							backgroundColor: colors.primary,
						},
					]}
				/>
			</View>
			<View
				pointerEvents='none'
				style={[
					styles.thumb,
					{
						left: fraction * width - THUMB_SIZE / 2,
						backgroundColor: colors.primary,
					},
				]}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		height: 44,
		justifyContent: 'center',
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
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: THUMB_SIZE / 2,
	},
})
