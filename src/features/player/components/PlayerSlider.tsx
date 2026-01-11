import { CustomSlider } from '@/features/player/components/CustomSlider'
import { usePlayerSlider } from '@/features/player/hooks/usePlayerSlider'
import { formatDurationToHHMMSS } from '@/utils/time'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import type { SharedValue } from 'react-native-reanimated'
import { useAnimatedReaction } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

function TextWithAnimation({
	sharedPosition,
	sharedDuration,
}: {
	sharedPosition: SharedValue<number>
	sharedDuration: SharedValue<number>
}) {
	const { colors } = useTheme()
	const [duration, setDuration] = useState(0)
	const [position, setPosition] = useState(0)

	useAnimatedReaction(
		() => {
			const truncDuration = sharedDuration.value
				? Math.trunc(sharedDuration.value)
				: null

			const truncPosition = sharedPosition.value
				? Math.trunc(sharedPosition.value)
				: null
			return [truncDuration, truncPosition]
		},
		([duration, position], prev) => {
			if (!prev) {
				scheduleOnRN(setDuration, duration ?? 0)
				scheduleOnRN(setPosition, position ?? 0)
				return
			}
			if (duration !== null && duration !== prev[0]) {
				scheduleOnRN(setDuration, duration)
			}
			if (position !== null && position !== prev[1]) {
				scheduleOnRN(setPosition, position)
			}
		},
	)

	return (
		<>
			<Text
				variant='bodySmall'
				style={{ color: colors.onSurfaceVariant }}
			>
				{formatDurationToHHMMSS(Math.trunc(position))}
			</Text>
			<Text
				variant='bodySmall'
				style={{ color: colors.onSurfaceVariant }}
			>
				{formatDurationToHHMMSS(Math.trunc(duration ?? 0))}
			</Text>
		</>
	)
}

export function PlayerSlider() {
	const {
		handleSlidingStart,
		handleSlidingComplete,
		sharedDuration,
		sharedPosition,
	} = usePlayerSlider()

	return (
		<View>
			<CustomSlider
				minimumValue={0}
				maximumValue={sharedDuration.value || 1}
				onSlidingStart={handleSlidingStart}
				onSlidingComplete={handleSlidingComplete}
				disabled={sharedDuration.value <= 0}
				value={sharedPosition}
				duration={sharedDuration}
			/>
			<View style={styles.timeContainer}>
				<TextWithAnimation
					sharedPosition={sharedPosition}
					sharedDuration={sharedDuration}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	timeContainer: {
		marginTop: -8,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 4,
	},
})
