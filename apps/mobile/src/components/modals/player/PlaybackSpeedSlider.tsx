import { Host, Slider } from '@expo/ui/jetpack-compose'
import { StyleSheet } from 'react-native'

export interface PlaybackSpeedSliderProps {
	value: number
	min: number
	max: number
	steps: number
	onValueChange: (value: number) => void
	onValueChangeFinished: () => void
}

export default function PlaybackSpeedSlider({
	value,
	min,
	max,
	steps,
	onValueChange,
	onValueChangeFinished,
}: PlaybackSpeedSliderProps) {
	return (
		<Host
			matchContents={{ vertical: true }}
			style={styles.host}
		>
			<Slider
				value={value}
				min={min}
				max={max}
				steps={steps}
				onValueChange={onValueChange}
				onValueChangeFinished={onValueChangeFinished}
			/>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		width: '100%',
	},
})
