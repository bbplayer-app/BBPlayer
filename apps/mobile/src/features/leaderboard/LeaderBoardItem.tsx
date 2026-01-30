import { memo } from 'react'
import { View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import useIsCurrentTrack from '@/hooks/player/useIsCurrentTrack'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import type { Track } from '@/types/core/media'
import { addToQueue } from '@/utils/player'
import { formatDurationToHHMMSS } from '@/utils/time'

interface LeaderBoardItemProps {
	item: {
		track: Track
		playCount: number
	}
	index: number
}

export const LeaderBoardListItem = memo(function LeaderBoardListItem({
	item,
	index,
}: LeaderBoardItemProps) {
	const { colors } = useTheme()
	const isCurrentTrack = useIsCurrentTrack(item.track.uniqueKey)

	return (
		<RectButton
			style={{
				backgroundColor: isCurrentTrack
					? colors.elevation.level5
					: 'transparent',
				paddingVertical: 4,
				paddingHorizontal: 8,
			}}
			onPress={() => {
				if (isCurrentTrack) return
				void addToQueue({
					tracks: [item.track],
					clearQueue: false,
					playNow: true,
					playNext: false,
					startFromKey: item.track.uniqueKey,
				})
			}}
		>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					paddingHorizontal: 8,
					paddingVertical: 6,
				}}
			>
				<View
					style={{
						width: 28,
						marginRight: 8,
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Text
						variant='bodyMedium'
						style={{ color: colors.onSurfaceVariant }}
					>
						{index + 1}
					</Text>
				</View>

				<CoverWithPlaceHolder
					id={item.track.uniqueKey}
					title={item.track.title}
					coverUrl={item.track.coverUrl}
					size={LIST_ITEM_COVER_SIZE}
				/>

				<View style={{ marginLeft: 12, flex: 1, marginRight: 4 }}>
					<Text variant='bodySmall'>{item.track.title}</Text>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							marginTop: 2,
						}}
					>
						{item.track.artist && (
							<>
								<Text
									variant='bodySmall'
									numberOfLines={1}
									style={{ color: colors.onSurfaceVariant }}
								>
									{item.track.artist.name ?? '未知'}
								</Text>
								<Text
									style={{
										marginHorizontal: 4,
										color: colors.onSurfaceVariant,
									}}
									variant='bodySmall'
								>
									•
								</Text>
							</>
						)}
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							{formatDurationToHHMMSS(item.track.duration)}
						</Text>
					</View>
				</View>

				<View style={{ alignItems: 'flex-end' }}>
					<Text
						variant='bodyMedium'
						style={{ color: colors.primary, fontWeight: 'bold' }}
					>
						{item.playCount}
					</Text>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						次播放
					</Text>
				</View>
			</View>
		</RectButton>
	)
})
