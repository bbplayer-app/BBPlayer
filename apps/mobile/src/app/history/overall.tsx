import { LegendList } from '@legendapp/list/react-native'
import { useRouter } from 'expo-router'
import { NumberFlow } from 'number-flow-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Appbar, Surface, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HistoryListItem } from '@/features/history/HistoryListItem'
import { TrackListItemSkeletonGroup } from '@/features/playlist/skeletons/PlaylistSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	usePlayCountHistoryPaginated,
	useTotalPlaybackDuration,
} from '@/hooks/queries/db/track'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import type { Track } from '@/types/core/media'

interface HistoryItemData {
	track: Track
	playCount: number
}

function PlaybackDurationFlow({ seconds }: { seconds: number }) {
	const { colors, fonts } = useTheme()
	const [displaySeconds, setDisplaySeconds] = useState(0)
	const durationTextStyle = {
		...fonts.headlineMedium,
		color: colors.primary,
	}

	useEffect(() => {
		// 先显示零值，再启动首次数字滚动。
		const timer = setTimeout(() => setDisplaySeconds(seconds), 100)
		return () => clearTimeout(timer)
	}, [seconds])

	const hours = Math.floor(displaySeconds / 3600)
	const minutes = Math.floor((displaySeconds % 3600) / 60)
	const remainingSeconds = displaySeconds % 60

	return (
		<View
			style={styles.totalDurationFlow}
			accessible
			accessibilityLabel={`${hours}小时${minutes}分${remainingSeconds}秒`}
		>
			<NumberFlow
				value={hours}
				suffix=':'
				format={{ useGrouping: false, minimumIntegerDigits: 2 }}
				style={durationTextStyle}
			/>
			<NumberFlow
				value={minutes}
				suffix=':'
				format={{ useGrouping: false, minimumIntegerDigits: 2 }}
				style={durationTextStyle}
			/>
			<NumberFlow
				value={remainingSeconds}
				format={{ useGrouping: false, minimumIntegerDigits: 2 }}
				style={durationTextStyle}
			/>
		</View>
	)
}

const renderItem = ({
	item,
	index,
}: {
	item: HistoryItemData
	index: number
}) => (
	<HistoryListItem
		item={item}
		index={index}
	/>
)

export default function OverallHistoryPage() {
	const isListReady = useScreenTransitionReady()
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const {
		data: historyData,
		isLoading: isHistoryLoading,
		isError: isHistoryError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = usePlayCountHistoryPaginated(30, true, 15)
	const showSkeleton = isHistoryLoading || !isListReady

	const { data: totalDurationData, isError: isTotalDurationError } =
		useTotalPlaybackDuration(true)

	const allTracks = useMemo(() => {
		return historyData?.pages.flatMap((page) => page.items) ?? []
	}, [historyData])

	const totalDuration =
		!isTotalDurationError && Number.isFinite(totalDurationData)
			? Math.max(0, Math.floor(totalDurationData ?? 0))
			: 0

	const keyExtractor = useCallback(
		(item: HistoryItemData) => item.track.uniqueKey,
		[],
	)

	const onEndReached = () => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage()
		}
	}

	const renderContent = () => {
		if (showSkeleton) {
			return (
				<TrackListItemSkeletonGroup
					count={2}
					animate={isListReady}
				/>
			)
		}

		if (isHistoryError) {
			return (
				<View style={styles.centeredContainer}>
					<Text>加载失败</Text>
				</View>
			)
		}

		if (allTracks.length === 0) {
			return (
				<View style={styles.centeredContainer}>
					<Text>暂无数据</Text>
				</View>
			)
		}

		return (
			<LegendList
				data={allTracks}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				recycleItems
				contentContainerStyle={{
					paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
				}}
				onEndReached={onEndReached}
				onEndReachedThreshold={0.8}
				showsVerticalScrollIndicator={false}
				ListFooterComponent={
					isFetchingNextPage ? (
						<TrackListItemSkeletonGroup
							count={1}
							animate
						/>
					) : !hasNextPage ? (
						<Text
							variant='bodyMedium'
							style={[styles.footerText, { color: colors.onSurfaceVariant }]}
						>
							已经到底啦
						</Text>
					) : null
				}
			/>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='全部统计' />
			</Appbar.Header>
			{(showSkeleton || (allTracks.length > 0 && !isTotalDurationError)) && (
				<Surface
					style={styles.totalDurationSurface}
					elevation={2}
				>
					{showSkeleton ? (
						<>
							<View
								style={[
									styles.summaryTitleSkeleton,
									{ backgroundColor: colors.surfaceVariant },
								]}
							/>
							<View
								style={[
									styles.summaryDurationSkeleton,
									{ backgroundColor: colors.surfaceVariant },
								]}
							/>
							<View
								style={[
									styles.summarySubtitleSkeleton,
									{ backgroundColor: colors.surfaceVariant },
								]}
							/>
						</>
					) : (
						<>
							<Text variant='titleMedium'>总计听歌时长</Text>
							<PlaybackDurationFlow seconds={totalDuration} />
							<Text
								variant='bodySmall'
								style={[
									styles.totalDurationSubText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								（仅统计完整播放的歌曲）
							</Text>
						</>
					)}
				</Surface>
			)}

			<View style={styles.contentContainer}>{renderContent()}</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	centeredContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	summaryTitleSkeleton: {
		width: 112,
		height: 24,
		borderRadius: 4,
	},
	summaryDurationSkeleton: {
		width: 180,
		height: 36,
		marginTop: 8,
		borderRadius: 4,
	},
	summarySubtitleSkeleton: {
		width: 196,
		height: 16,
		marginTop: 4,
		borderRadius: 4,
	},
	footerText: {
		textAlign: 'center',
		paddingTop: 10,
	},
	totalDurationSurface: {
		marginHorizontal: 16,
		marginTop: 16,
		marginBottom: 8,
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: 'center',
	},
	totalDurationFlow: {
		marginTop: 8,
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
	},
	totalDurationSubText: {
		marginTop: 4,
	},
	contentContainer: {
		flex: 1,
	},
})
