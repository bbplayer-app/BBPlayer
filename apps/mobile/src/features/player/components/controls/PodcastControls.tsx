import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import { usePlaybackOptions } from '@/hooks/player/usePlaybackOptions'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerChaptersSheetStore } from '@/hooks/stores/usePlayerChaptersSheetStore'
import { usePlayerCommentsPaneStore } from '@/hooks/stores/usePlayerCommentsPaneStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { formatDurationToHHMMSS } from '@/utils/time'

import {
	MainPlaybackControls,
	SecondaryPlaybackControls,
} from './PlayerControlContent'

export function PodcastControls({
	commentsPane = false,
	compact = false,
}: {
	/** 仅宽屏播放器提供：以侧边面板展示评论。 */
	commentsPane?: boolean
	compact?: boolean
}) {
	const { colors } = useTheme()

	const commentsOpen = usePlayerCommentsPaneStore(
		(state) => commentsPane && state.isOpen,
	)

	const { speed, sleepEndTime } = usePlaybackOptions()
	const [now, setNow] = useState(() => Date.now())
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
		...(commentsPane
			? [
					{
						icon: 'comment-text-outline',
						accessibilityLabel: '打开评论',
						onPress: () => usePlayerCommentsPaneStore.getState().toggle(),
						selected: commentsOpen,
					},
				]
			: []),
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
			<View style={{ marginTop: compact ? 8 : 24 }}>
				<MainPlaybackControls
					podcast
					size={compact ? 'compact' : 'normal'}
				/>
			</View>
			<SecondaryPlaybackControls compact={compact}>
				{actions.map((action) => (
					<IconButton
						testID={`podcast-control-${action.icon}`}
						key={action.icon}
						icon={action.icon}
						size={24}
						iconColor={
							'selected' in action && action.selected
								? colors.primary
								: colors.onSurfaceVariant
						}
						onPress={action.onPress}
						accessibilityLabel={action.accessibilityLabel}
					/>
				))}
			</SecondaryPlaybackControls>
		</View>
	)
}
