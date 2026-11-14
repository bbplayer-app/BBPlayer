import { WavySlider } from 'expo-wavy-slider'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { scheduleOnRN } from 'react-native-worklets'

import type { PlaybackSpeedSliderProps } from './PlaybackSpeedSlider'

/**
 * The player's slider, snapped to the speed steps. On iOS it is drawn with React Native
 * views, which keeps working inside this dialog where the SwiftUI slider stalls.
 */
export default function PlaybackSpeedSlider({
	value,
	min,
	max,
	steps,
	onValueChange,
	onValueChangeFinished,
}: PlaybackSpeedSliderProps) {
	const { colors } = useTheme()
	const step = (max - min) / (steps + 1)

	// The slider reports from the UI thread, and the dialog keeps the speed in React state.
	const handleValueChange = (next: number) => {
		'worklet'
		scheduleOnRN(onValueChange, min + Math.round((next - min) / step) * step)
	}

	const handleValueChangeFinished = () => {
		'worklet'
		scheduleOnRN(onValueChangeFinished)
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
		>
			<WavySlider
				style={styles.slider}
				value={value}
				min={min}
				max={max}
				colors={{
					activeTrackColor: colors.primary,
					inactiveTrackColor: colors.surfaceVariant,
					thumbColor: colors.primary,
				}}
				onValueChange={handleValueChange}
				onValueChangeFinished={handleValueChangeFinished}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	slider: {
		height: 44,
	},
})
