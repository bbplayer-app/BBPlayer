import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { formatDurationToHHMMSS } from '@/utils/time'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Button, Dialog, Text, TextInput } from 'react-native-paper'

const PRESET_DURATIONS = [15, 30, 45, 60] // in minutes

const SleepTimerModal = () => {
	const close = useModalStore((state) => state.close)
	const sleepTimerEndAt = usePlayerStore((state) => state.sleepTimerEndAt)
	const setSleepTimer = usePlayerStore((state) => state.setSleepTimer)
	const [remainingTime, setRemainingTime] = useState<number | null>(null)
	const [customInputVisible, setCustomInputVisible] = useState(false)
	const [customMinutes, setCustomMinutes] = useState('')

	useEffect(() => {
		if (sleepTimerEndAt) {
			const interval = setInterval(() => {
				const remaining = Math.round((sleepTimerEndAt - Date.now()) / 1000)
				if (remaining > 0) {
					setRemainingTime(remaining)
				} else {
					setRemainingTime(null)
					clearInterval(interval)
				}
			}, 1000)
			const remaining = Math.round((sleepTimerEndAt - Date.now()) / 1000)
			setRemainingTime(remaining > 0 ? remaining : null)

			return () => clearInterval(interval)
		} else {
			setRemainingTime(null)
		}
	}, [sleepTimerEndAt])

	const handleSetTimer = (minutes: number) => {
		setSleepTimer(minutes * 60)
		close('SleepTimer')
	}

	const handleCancelTimer = () => {
		setSleepTimer(null)
		close('SleepTimer')
	}

	return (
		<>
			<Dialog.Title>定时关闭</Dialog.Title>
			<Dialog.Content>
				{remainingTime ? (
					<View style={{ alignItems: 'center', marginBottom: 16 }}>
						<Text variant='headlineMedium'>
							剩余 {formatDurationToHHMMSS(remainingTime)}
						</Text>
					</View>
				) : (
					<Text style={{ textAlign: 'center', marginBottom: 16 }}>
						选择一个预设时间或自定义
					</Text>
				)}
				<View
					style={{
						flexDirection: 'row',
						flexWrap: 'wrap',
						justifyContent: 'center',
						gap: 8,
						marginBottom: 8,
					}}
				>
					{PRESET_DURATIONS.map((minutes) => (
						<Button
							key={minutes}
							mode='contained-tonal'
							onPress={() => handleSetTimer(minutes)}
							style={{ width: '48%' }}
						>
							{minutes} 分钟
						</Button>
					))}
				</View>
				{customInputVisible ? (
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<TextInput
							label='分钟'
							value={customMinutes}
							onChangeText={setCustomMinutes}
							keyboardType='numeric'
							autoFocus
							mode='outlined'
							style={{ flex: 1, marginRight: 8 }}
						/>
						<Button
							mode='contained'
							onPress={() => {
								const minutes = parseInt(customMinutes, 10)
								if (!isNaN(minutes) && minutes > 0) {
									handleSetTimer(minutes)
								}
							}}
						>
							设置
						</Button>
					</View>
				) : (
					<Button
						mode='text'
						onPress={() => setCustomInputVisible(true)}
					>
						自定义
					</Button>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				{sleepTimerEndAt && (
					<Button
						onPress={handleCancelTimer}
						textColor='red'
					>
						取消定时器
					</Button>
				)}
				<Button onPress={() => close('SleepTimer')}>关闭</Button>
			</Dialog.Actions>
		</>
	)
}

export default SleepTimerModal
