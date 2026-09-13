import { Orpheus } from '@bbplayer/orpheus'
import { Host, Slider } from '@expo/ui/jetpack-compose'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'

const MIN_SPEED = 0.1
const MAX_SPEED = 3.0
const SPEED_STEP = 0.1
const SPEED_STEPS = Math.round((MAX_SPEED - MIN_SPEED) / SPEED_STEP) - 1

const roundSpeed = (value: number) => Math.round(value * 100) / 100

const PlaybackSpeedModal = () => {
	const close = useModalStore((state) => state.close)
	const [speed, setSpeed] = useState<number>(1.0)
	const committedSpeedRef = useRef(1.0)
	const pendingSpeedRef = useRef(1.0)

	useEffect(() => {
		void Orpheus.getPlaybackSpeed().then((currentSpeed) => {
			committedSpeedRef.current = currentSpeed
			pendingSpeedRef.current = currentSpeed
			setSpeed(currentSpeed)
		})

		const subscription = Orpheus.addListener(
			'onPlaybackSpeedChanged',
			(event: { speed: number }) => {
				committedSpeedRef.current = event.speed
				pendingSpeedRef.current = event.speed
				setSpeed(event.speed)
			},
		)
		return () => subscription.remove()
	}, [])

	const commitSpeed = async (newSpeed: number) => {
		try {
			const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, newSpeed))
			await Orpheus.setPlaybackSpeed(clampedSpeed)
		} catch (e) {
			setSpeed(committedSpeedRef.current)
			toastAndLogError('设置播放速度失败', e, 'Modal.PlaybackSpeed')
		}
	}

	const handleValueChange = (value: number) => {
		const roundedSpeed = roundSpeed(value)
		pendingSpeedRef.current = roundedSpeed
		setSpeed(roundedSpeed)
	}

	const handleValueChangeFinished = () => {
		void commitSpeed(pendingSpeedRef.current)
	}

	const handleReset = () => {
		pendingSpeedRef.current = 1.0
		setSpeed(1.0)
		void commitSpeed(1.0)
	}

	return (
		<>
			<Dialog.Title>播放速度</Dialog.Title>
			<Dialog.Content>
				<View style={styles.headerContainer}>
					<Text
						variant='headlineMedium'
						style={styles.speedDisplay}
					>
						当前: {speed.toFixed(2)}x
					</Text>
				</View>

				<View style={styles.sliderContainer}>
					<Host
						matchContents={{ vertical: true }}
						style={styles.sliderHost}
					>
						<Slider
							value={speed}
							min={MIN_SPEED}
							max={MAX_SPEED}
							steps={SPEED_STEPS}
							onValueChange={handleValueChange}
							onValueChangeFinished={handleValueChangeFinished}
						/>
					</Host>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={handleReset}>重置</Button>
				<Button onPress={() => close('PlaybackSpeed')}>关闭</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	headerContainer: {
		alignItems: 'center',
		marginBottom: 16,
	},
	speedDisplay: {
		fontWeight: 'bold',
	},
	sliderContainer: {
		marginTop: 8,
	},
	sliderHost: {
		width: '100%',
	},
})

export default PlaybackSpeedModal
