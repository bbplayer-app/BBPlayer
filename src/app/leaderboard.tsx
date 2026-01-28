import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Appbar,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import NowPlayingBar from '@/components/NowPlayingBar'
import { LeaderBoardListItem } from '@/features/leaderboard/LeaderBoardItem'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	usePlayCountLeaderBoardPaginated,
	useTotalPlaybackDuration,
} from '@/hooks/queries/db/track'
import type { Track } from '@/types/core/media'

interface LeaderBoardItemData {
	track: Track
	playCount: number
}

const formatDurationToWords = (seconds: number) => {
	if (isNaN(seconds) || seconds < 0) {
		return '0\u2009秒'
	}
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = Math.floor(seconds % 60)

	const parts = []
	if (h > 0) parts.push(`${h}\u2009时`)
	if (m > 0) parts.push(`${m}\u2009分`)
	if (s > 0 || parts.length === 0) parts.push(`${s}\u2009秒`)

	return parts.join('\u2009')
}

const renderItem = ({
	item,
	index,
}: {
	item: LeaderBoardItemData
	index: number
}) => (
	<LeaderBoardListItem
		item={item}
		index={index}
	/>
)

export default function LeaderBoardPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const {
		data: leaderBoardData,
		isLoading: isLeaderBoardLoading,
		isError: isLeaderBoardError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = usePlayCountLeaderBoardPaginated(30, true, 15)
	const { data: totalDurationData, isError: isTotalDurationError } =
		useTotalPlaybackDuration(true)

	const allTracks = useMemo(() => {
		return leaderBoardData?.pages.flatMap((page) => page.items) ?? []
	}, [leaderBoardData])

	const totalDuration = useMemo(() => {
		if (isTotalDurationError || !totalDurationData) return '0\u2009秒'
		return formatDurationToWords(totalDurationData)
	}, [totalDurationData, isTotalDurationError])

	const keyExtractor = useCallback(
		(item: LeaderBoardItemData) => item.track.uniqueKey,
		[],
	)

	const onEndReached = () => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage()
		}
	}

	const renderContent = () => {
		if (isLeaderBoardLoading) {
			return (
				<ActivityIndicator
					animating={true}
					style={styles.loadingIndicator}
				/>
			)
		}

		if (isLeaderBoardError) {
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
			<FlashList
				data={allTracks}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				contentContainerStyle={{
					paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
				}}
				onEndReached={onEndReached}
				onEndReachedThreshold={0.8}
				showsVerticalScrollIndicator={false}
				ListFooterComponent={
					isFetchingNextPage ? (
						<View style={styles.footerLoadingContainer}>
							<ActivityIndicator size='small' />
						</View>
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
				<Appbar.Content title='统计' />
			</Appbar.Header>
			{allTracks.length > 0 && !isTotalDurationError && (
				<Surface
					style={styles.totalDurationSurface}
					elevation={2}
				>
					<Text variant='titleMedium'>总计听歌时长</Text>
					<Text
						variant='headlineMedium'
						style={[styles.totalDurationText, { color: colors.primary }]}
					>
						{totalDuration}
					</Text>
					<Text
						variant='bodySmall'
						style={[
							styles.totalDurationSubText,
							{ color: colors.onSurfaceVariant },
						]}
					>
						（仅统计完整播放的歌曲）
					</Text>
				</Surface>
			)}

			<View style={styles.contentContainer}>{renderContent()}</View>

			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingIndicator: {
		marginTop: 20,
	},
	centeredContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	footerLoadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
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
	totalDurationText: {
		marginTop: 8,
	},
	totalDurationSubText: {
		marginTop: 4,
	},
	contentContainer: {
		flex: 1,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
