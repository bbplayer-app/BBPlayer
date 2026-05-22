import { Orpheus } from '@bbplayer/orpheus'
import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { width } from '@expo/ui/jetpack-compose/modifiers'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

const PRESET_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

const PlaybackSpeedModal = () => {
	const close = useModalStore((state) => state.close)
	const [speed, setSpeed] = useState<number>(1.0)
	const [customInputVisible, setCustomInputVisible] = useState(false)
	const [customSpeed, setCustomSpeed] = useState('')
	const customSpeedState = useTextFieldState(customSpeed)

	useEffect(() => {
		void Orpheus.getPlaybackSpeed().then(setSpeed)

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
			const clampedSpeed = Math.max(0.1, Math.min(5.0, newSpeed))
			await Orpheus.setPlaybackSpeed(clampedSpeed)
			setSpeed(clampedSpeed)
		} catch (e) {
			toastAndLogError('设置播放速度失败', e, 'Modal.PlaybackSpeed')
		}
	}

	const handleCustomSpeedSubmit = async () => {
		const parsedSpeed = parseFloat(customSpeed)
		if (!isNaN(parsedSpeed) && parsedSpeed > 0) {
			await handleSpeedChange(parsedSpeed)
			setCustomInputVisible(false)
		} else {
			toast.error('请输入有效的播放速度')
		}
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

				<View style={styles.presetContainer}>
					{PRESET_SPEEDS.map((preset) => (
						<Button
							key={preset}
							mode={
								Math.abs(speed - preset) < 0.01
									? 'contained'
									: 'contained-tonal'
							}
							onPress={() => handleSpeedChange(preset)}
							style={styles.presetButton}
							compact
						>
							{preset}x
						</Button>
					))}
				</View>

				{customInputVisible ? (
					<View style={styles.customInputContainer}>
						<Host
							matchContents
							style={styles.customInput}
						>
							<OutlinedTextField
								value={customSpeedState}
								onValueChange={setCustomSpeed}
								autoFocus
								singleLine
								keyboardOptions={{
									keyboardType: 'decimal',
									imeAction: 'done',
								}}
								keyboardActions={{ onDone: handleCustomSpeedSubmit }}
								modifiers={[width(180)]}
							>
								<OutlinedTextField.Label>
									<ComposeText>自定义速度 (0.1 - 5.0)</ComposeText>
								</OutlinedTextField.Label>
							</OutlinedTextField>
						</Host>
						<Button
							mode='contained'
							onPress={handleCustomSpeedSubmit}
						>
							设置
						</Button>
					</View>
				) : (
					<Button
						mode='text'
						onPress={() => {
							setCustomSpeed(speed.toString())
							setCustomInputVisible(true)
						}}
					>
						自定义...
					</Button>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => handleSpeedChange(1.0)}>重置</Button>
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
	presetContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
		marginBottom: 8,
	},
	presetButton: {
		minWidth: '30%',
		flexGrow: 1,
	},
	customInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 8,
	},
	customInput: {
		flex: 1,
		marginRight: 8,
	},
})

export default PlaybackSpeedModal
