import { Orpheus } from '@roitium/expo-orpheus'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Dialog, Text, TextInput } from 'react-native-paper'

import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import { formatDurationToHHMMSS } from '@/utils/time'
import toast from '@/utils/toast'

const PRESET_DURATIONS = [15, 30, 45, 60] // in minutes

const SleepTimerModal = () => {
	const close = useModalStore((state) => state.close)
	const [remainingTime, setRemainingTime] = useState<number | null>(null)
	const { data: sleepTimerEndAt } = useQuery({
		queryFn: async () => {
			return await Orpheus.getSleepTimerEndTime()
		},
		queryKey: ['sleepTimerEndAt'],
		gcTime: 0,
		staleTime: 0,
	})
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

	const handleSetTimer = async (minutes: number) => {
		try {
			await Orpheus.setSleepTimer(minutes * 60 * 1000)
			toast.success('设置定时器成功')
			close('SleepTimer')
		} catch (e) {
			toastAndLogError('设置定时器失败', e, 'Modal.SleepTimer')
		}
	}

	const handleCancelTimer = async () => {
		await Orpheus.cancelSleepTimer()
		toast.success('取消定时器成功')
		close('SleepTimer')
	}

	return (
		<>
			<Dialog.Title>定时关闭</Dialog.Title>
			<Dialog.Content>
				{remainingTime ? (
					<View style={styles.remainingTimeContainer}>
						<Text variant='headlineMedium'>
							剩余 {formatDurationToHHMMSS(remainingTime)}
						</Text>
					</View>
				) : (
					<Text style={styles.promptText}>选择一个预设时间或自定义</Text>
				)}
				<View style={styles.presetContainer}>
					{PRESET_DURATIONS.map((minutes) => (
						<Button
							key={minutes}
							mode='contained-tonal'
							onPress={() => handleSetTimer(minutes)}
							style={styles.presetButton}
						>
							{minutes}
							{'\u2009'}分钟
						</Button>
					))}
				</View>
				{customInputVisible ? (
					<View style={styles.customInputContainer}>
						<TextInput
							label='分钟'
							value={customMinutes}
							onChangeText={setCustomMinutes}
							keyboardType='numeric'
							autoFocus
							mode='outlined'
							style={styles.customInput}
						/>
						<Button
							mode='contained'
							onPress={async () => {
								const minutes = parseInt(customMinutes, 10)
								if (!isNaN(minutes) && minutes > 0) {
									await handleSetTimer(minutes)
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

const styles = StyleSheet.create({
	remainingTimeContainer: {
		alignItems: 'center',
		marginBottom: 16,
	},
	promptText: {
		textAlign: 'center',
		marginBottom: 16,
	},
	presetContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 8,
		marginBottom: 8,
	},
	presetButton: {
		flexBasis: '45%',
		flexGrow: 1,
	},
	customInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	customInput: {
		flex: 1,
		marginRight: 8,
	},
})

export default SleepTimerModal
