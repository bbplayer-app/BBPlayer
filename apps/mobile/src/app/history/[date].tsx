import { FlashList } from '@shopify/flash-list'
import dayjs from 'dayjs'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Appbar, Surface, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import NowPlayingBar from '@/components/NowPlayingBar'
import { HistoryListItem } from '@/features/history/HistoryListItem'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePlayHistoryByDayOfMonth } from '@/hooks/queries/playHistory'
import type { Track } from '@/types/core/media'

interface HistoryItemData {
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
	item: HistoryItemData
	index: number
}) => (
	<HistoryListItem
		item={item}
		index={index}
	/>
)

export default function DateHistoryPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const { date } = useLocalSearchParams<{ date: string }>()
	const dayOfMonth = date ? dayjs(date).date() : null

	const {
		data: historyRecords,
		isLoading: isHistoryLoading,
		isError: isHistoryError,
	} = usePlayHistoryByDayOfMonth(dayOfMonth ?? 0)

	const getAggregatedHistory = () => {
		if (!historyRecords) return { aggregatedTracks: [], totalDuration: 0 }

		const trackMap = new Map<string, { track: Track; playCount: number }>()
		let duration = 0

		for (const record of historyRecords) {
			const key = record.uniqueKey
			if (!trackMap.has(key)) {
				trackMap.set(key, { track: record as Track, playCount: 0 })
			}
			trackMap.get(key)!.playCount += 1
			duration += record.duration ?? 0
		}

		const sortedTracks = Array.from(trackMap.values()).sort(
			(a, b) => b.playCount - a.playCount,
		)

		return { aggregatedTracks: sortedTracks, totalDuration: duration }
	}
	const { aggregatedTracks, totalDuration } = getAggregatedHistory()

	const getTotalDurationStr = () => {
		if (isHistoryError || !historyRecords) return '0\u2009秒'
		return formatDurationToWords(totalDuration)
	}
	const totalDurationStr = getTotalDurationStr()

	const keyExtractor = useCallback(
		(item: HistoryItemData) => item.track.uniqueKey,
		[],
	)

	const renderContent = () => {
		if (isHistoryLoading) {
			return <ActivityIndicator style={styles.loadingIndicator} />
		}

		if (isHistoryError) {
			return (
				<View style={styles.centeredContainer}>
					<Text>加载失败</Text>
				</View>
			)
		}

		if (aggregatedTracks.length === 0) {
			return (
				<View style={styles.centeredContainer}>
					<Text>暂无数据</Text>
				</View>
			)
		}

		return (
			<FlashList
				data={aggregatedTracks}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				contentContainerStyle={{
					paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
				}}
				showsVerticalScrollIndicator={false}
			/>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={date} />
			</Appbar.Header>
			{aggregatedTracks.length > 0 && !isHistoryError && (
				<>
					<Surface
						style={styles.totalDurationSurface}
						elevation={2}
					>
						<Text variant='titleMedium'>当日听歌时长</Text>
						<Text
							variant='headlineMedium'
							style={[styles.totalDurationText, { color: colors.primary }]}
						>
							{totalDurationStr}
						</Text>
					</Surface>
				</>
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
