import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import Slider from '@react-native-community/slider'
import { Orpheus } from '@roitium/expo-orpheus'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Dialog, IconButton, Text } from 'react-native-paper'

const PRESET_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

const PlaybackSpeedModal = () => {
	const close = useModalStore((state) => state.close)
	const [speed, setSpeed] = useState<number>(1.0)

	const { data: currentSpeed } = useQuery({
		queryKey: ['playbackSpeed'],
		queryFn: async () => {
			return await Orpheus.getPlaybackSpeed()
		},
		staleTime: 0,
	})

	useEffect(() => {
		if (currentSpeed) {
			setSpeed(currentSpeed)
		}
	}, [currentSpeed])

	useEffect(() => {
		const subscription = Orpheus.addListener(
			'onPlaybackSpeedChanged',
			(event: { speed: number }) => {
				setSpeed(event.speed)
			},
		)
		return () => subscription.remove()
	}, [])

	const handleSpeedChange = async (newSpeed: number) => {
		try {
			// Clamp value between 0.25 and 2.0
			const clampedSpeed = Math.max(0.25, Math.min(2.0, newSpeed))
			await Orpheus.setPlaybackSpeed(clampedSpeed)
			setSpeed(clampedSpeed)
		} catch (e) {
			toastAndLogError('设置播放速度失败', e, 'Modal.PlaybackSpeed')
		}
	}

	return (
		<>
			<Dialog.Title>播放速度</Dialog.Title>
			<Dialog.Content>
				<View style={styles.container}>
					<Text
						variant='displaySmall'
						style={styles.speedDisplay}
					>
						{speed.toFixed(2)}x
					</Text>

					<View style={styles.sliderContainer}>
						<IconButton
							icon='minus'
							onPress={() => handleSpeedChange(Math.max(0.25, speed - 0.1))}
							disabled={speed <= 0.25}
						/>
						<Slider
							style={styles.slider}
							minimumValue={0.25}
							maximumValue={2.0}
							step={0.05}
							value={speed}
							onValueChange={handleSpeedChange}
							minimumTrackTintColor='#6200ee'
							maximumTrackTintColor='#000000'
							thumbTintColor='#6200ee'
						/>
						<IconButton
							icon='plus'
							onPress={() => handleSpeedChange(Math.min(2.0, speed + 0.1))}
							disabled={speed >= 2.0}
						/>
					</View>

					<View style={styles.presetContainer}>
						{PRESET_SPEEDS.map((preset) => (
							<Button
								key={preset}
								mode={
									Math.abs(speed - preset) < 0.05 ? 'contained' : 'outlined'
								}
								onPress={() => handleSpeedChange(preset)}
								style={styles.presetButton}
								compact
							>
								{preset}x
							</Button>
						))}
					</View>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => handleSpeedChange(1.0)}>重置</Button>
				<Button onPress={() => close('PlaybackSpeed')}>关闭</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		paddingVertical: 10,
	},
	speedDisplay: {
		marginBottom: 20,
		fontWeight: 'bold',
	},
	sliderContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		marginBottom: 20,
	},
	slider: {
		flex: 1,
		height: 40,
	},
	presetContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
	},
	presetButton: {
		minWidth: 60,
	},
})

export default PlaybackSpeedModal
