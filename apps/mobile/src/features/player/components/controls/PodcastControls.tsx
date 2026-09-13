import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import { usePlaybackOptions } from '@/hooks/player/usePlaybackOptions'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerChaptersSheetStore } from '@/hooks/stores/usePlayerChaptersSheetStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { formatDurationToHHMMSS } from '@/utils/time'

import {
	MainPlaybackControls,
	SecondaryPlaybackControls,
} from './PlayerControlContent'

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
			accessibilityLabel: `倍速，当前 ${speed} 倍`,
			onPress: () => useModalStore.getState().open('PlaybackSpeed', undefined),
		},
		{
			icon: 'timer-outline',
			accessibilityLabel:
				remaining > 0
					? `定时关闭，剩余 ${formatDurationToHHMMSS(remaining)}`
					: '定时关闭',
			onPress: () => useModalStore.getState().open('SleepTimer', undefined),
		},
		{
			icon: 'book-open-page-variant-outline',
			accessibilityLabel: '打开章节列表',
			onPress: () => {
				void usePlayerChaptersSheetStore.getState().open()
			},
		},
		{
			icon: 'format-list-bulleted',
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
			<SecondaryPlaybackControls>
				{actions.map((action) => (
					<IconButton
						key={action.icon}
						icon={action.icon}
						size={24}
						iconColor={colors.onSurfaceVariant}
						onPress={action.onPress}
						accessibilityLabel={action.accessibilityLabel}
					/>
				))}
			</SecondaryPlaybackControls>
		</View>
	)
}
