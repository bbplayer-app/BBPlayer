import NowPlayingBar from '@/components/NowPlayingBar'
import {
	usePlayCountLeaderboard,
	useTotalPlaybackDuration,
} from '@/hooks/queries/db/track'
import useCurrentTrack from '@/hooks/stores/playerHooks/useCurrentTrack'
import type { Track } from '@/types/core/media'
import { useNavigation } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useCallback, useMemo } from 'react'
import { View } from 'react-native'
import {
	ActivityIndicator,
	Appbar,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LeaderboardListItem } from './components/LeaderboardItem'

interface LeaderboardItemData {
	track: Track
	playCount: number
}

const formatDurationToWords = (seconds: number) => {
	if (isNaN(seconds) || seconds < 0) {
		return '0秒'
	}
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = Math.floor(seconds % 60)

	const parts = []
	if (h > 0) parts.push(`${h}时`)
	if (m > 0) parts.push(`${m}分`)
	if (s > 0 || parts.length === 0) parts.push(`${s}秒`)

	return parts.join(' ')
}

export default function LeaderboardPage() {
	const { colors } = useTheme()
	const navigation = useNavigation()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()

	const {
		data: leaderboardData,
		isLoading: isLeaderboardLoading,
		isError: isLeaderboardError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = usePlayCountLeaderboard({
		limit: 30,
		onlyCompleted: true,
	})
	const { data: totalDurationData, isError: isTotalDurationError } =
		useTotalPlaybackDuration(true)

	const allTracks = useMemo(() => {
		return leaderboardData?.pages.flatMap((page) => page.items) ?? []
	}, [leaderboardData])

	const totalDuration = useMemo(() => {
		if (isTotalDurationError || !totalDurationData) return '0秒'
		return formatDurationToWords(totalDurationData)
	}, [totalDurationData, isTotalDurationError])

	const renderItem = useCallback(
		({ item, index }: { item: LeaderboardItemData; index: number }) => (
			<LeaderboardListItem
				item={item}
				index={index}
			/>
		),
		[],
	)

	const keyExtractor = useCallback(
		(item: LeaderboardItemData) => item.track.uniqueKey,
		[],
	)

	const onEndReached = () => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage()
		}
	}

	const renderContent = () => {
		if (isLeaderboardLoading) {
			return (
				<ActivityIndicator
					animating={true}
					style={{ marginTop: 20 }}
				/>
			)
		}

		if (isLeaderboardError) {
			return (
				<View
					style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
				>
					<Text>加载失败</Text>
				</View>
			)
		}

		if (allTracks.length === 0) {
			return (
				<View
					style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
				>
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
					paddingBottom: currentTrack ? 70 + insets.bottom : insets.bottom,
				}}
				onEndReached={onEndReached}
				onEndReachedThreshold={0.8}
				ListFooterComponent={
					<View style={{ paddingVertical: 32, alignItems: 'center' }}>
						{isFetchingNextPage ? (
							<ActivityIndicator />
						) : !hasNextPage ? (
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								已经到底啦
							</Text>
						) : null}
					</View>
				}
			/>
		)
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => navigation.goBack()} />
				<Appbar.Content title='统计' />
			</Appbar.Header>
			{allTracks.length > 0 && !isTotalDurationError && (
				<Surface
					style={{
						marginHorizontal: 16,
						marginTop: 16,
						marginBottom: 8,
						paddingVertical: 16,
						borderRadius: 12,
						alignItems: 'center',
					}}
					elevation={2}
				>
					<Text variant='titleMedium'>总计听歌时长</Text>
					<Text
						variant='headlineMedium'
						style={{ marginTop: 8, color: colors.primary }}
					>
						{totalDuration}
					</Text>
					<Text
						variant='bodySmall'
						style={{ marginTop: 4, color: colors.onSurfaceVariant }}
					>
						（仅统计完整播放的歌曲）
					</Text>
				</Surface>
			)}

			<View style={{ flex: 1 }}>{renderContent()}</View>

			<View
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
				}}
			>
				<NowPlayingBar />
			</View>
		</View>
	)
}
