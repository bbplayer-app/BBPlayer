import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper'

import { MainPlaybackControls } from '@/features/player/components/PlayerControls'
import { usePlaybackOptions } from '@/hooks/player/usePlaybackOptions'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerChaptersSheetStore } from '@/hooks/stores/usePlayerChaptersSheetStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { formatDurationToHHMMSS } from '@/utils/time'

export function PodcastControls() {
	const { colors } = useTheme()
	const { speed, sleepEndTime } = usePlaybackOptions()
	const [now, setNow] = useState(Date.now())
	useEffect(() => {
		if (!sleepEndTime) return
		const interval = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(interval)
	}, [sleepEndTime])
	const remaining = sleepEndTime
		? Math.max(0, Math.ceil((sleepEndTime - now) / 1000))
		: 0
	const actions = [
		{
			icon: 'speedometer',
			label: `${speed}×`,
			accessibilityLabel: `倍速，当前 ${speed} 倍`,
			onPress: () => useModalStore.getState().open('PlaybackSpeed', undefined),
		},
		{
			icon: 'timer-outline',
			label: remaining > 0 ? formatDurationToHHMMSS(remaining) : '定时关闭',
			accessibilityLabel:
				remaining > 0
					? `定时关闭，剩余 ${formatDurationToHHMMSS(remaining)}`
					: '定时关闭',
			onPress: () => useModalStore.getState().open('SleepTimer', undefined),
		},
		{
			icon: 'book-open-page-variant-outline',
			label: '章节',
			accessibilityLabel: '打开章节列表',
			onPress: () => {
				void usePlayerChaptersSheetStore.getState().open()
			},
		},
		{
			icon: 'format-list-bulleted',
			label: '播放队列',
			accessibilityLabel: '打开播放队列',
			onPress: () => {
				void usePlayerQueueSheetStore.getState().open()
			},
		},
	]
	return (
		<View>
			<View style={{ marginTop: 24 }}>
				<MainPlaybackControls />
			</View>
			<View style={styles.actions}>
				{actions.map((action) => (
					<TouchableRipple
						key={action.icon}
						onPress={action.onPress}
						accessibilityLabel={action.accessibilityLabel}
						accessibilityRole='button'
						style={styles.action}
					>
						<View style={styles.actionContent}>
							<Icon
								source={action.icon}
								size={24}
								color={colors.onSurfaceVariant}
							/>
							<Text
								variant='labelSmall'
								numberOfLines={1}
								style={{ color: colors.onSurfaceVariant }}
							>
								{action.label}
							</Text>
						</View>
					</TouchableRipple>
				))}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	actions: { flexDirection: 'row', marginTop: 16 },
	action: { flex: 1, borderRadius: 12, overflow: 'hidden', minHeight: 64 },
	actionContent: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 8,
		gap: 8,
	},
})
