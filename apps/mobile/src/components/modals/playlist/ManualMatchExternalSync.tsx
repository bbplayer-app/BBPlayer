import { FlashList } from '@shopify/flash-list'
import { decode } from 'he'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Button,
	Dialog,
	Searchbar,
	Text,
	TouchableRipple,
} from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { useSearchResults } from '@/hooks/queries/bilibili/search'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { GenericTrack } from '@/types/external_playlist'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import { formatDurationToHHMMSS } from '@/utils/time'

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	BilibiliSearchVideo,
	{
		handlePressItem: (item: BilibiliSearchVideo) => void
	}
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	return (
		<SearchItem
			item={item}
			onPress={extraData.handlePressItem}
		/>
	)
}

const SearchItem = memo(function SearchItem({
	item,
	onPress,
}: {
	item: BilibiliSearchVideo
	onPress: (item: BilibiliSearchVideo) => void
}) {
	const coverUrl = item.pic.startsWith('//') ? `https:${item.pic}` : item.pic
	return (
		<TouchableRipple
			style={styles.searchItem}
			onPress={() => onPress(item)}
		>
			<View style={styles.itemContainer}>
				<CoverWithPlaceHolder
					id={item.bvid}
					cover={coverUrl}
					size={40}
					title={item.title}
				/>
				<View style={styles.searchItemContent}>
					<Text
						variant='bodyMedium'
						numberOfLines={1}
					>
						{item.title
							.replace(/<em class="keyword">/g, '')
							.replace(/<\/em>/g, '')}
					</Text>
					<Text
						variant='bodySmall'
						numberOfLines={1}
					>
						{item.author} -{' '}
						{formatDurationToHHMMSS(
							Math.round(
								parseInt(item.duration.split(':')[0]) * 60 +
									parseInt(item.duration.split(':')[1]),
							),
						)}
					</Text>
				</View>
			</View>
		</TouchableRipple>
	)
})

export default function ManualMatchExternalSync({
	track,
	initialQuery,
	onMatch,
}: {
	track: GenericTrack
	initialQuery: string
	onMatch: (result: MatchResult) => void
}) {
	const [query, setQuery] = useState(initialQuery)
	const [finalQuery, setFinalQuery] = useState(initialQuery)
	const close = useModalStore((state) => state.close)

	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useSearchResults(finalQuery)

	const allVideos = useMemo(() => {
		if (!data?.pages) {
			return []
		}

		const allTracks = data.pages.flatMap((page) => page.result)
		const uniqueMap = new Map(
			allTracks.map((track) => [
				track.bvid,
				{
					...track,
					title: decode(track.title),
				},
			]),
		)
		return [...uniqueMap.values()]
	}, [data])

	const handlePressItem = useCallback(
		(video: BilibiliSearchVideo) => {
			onMatch({
				track,
				matchedVideo: video,
			})
			close('ManualMatchExternalSync')
		},
		[close, onMatch, track],
	)

	const extraData = useMemo(() => ({ handlePressItem }), [handlePressItem])

	const keyExtractor = useCallback((item: BilibiliSearchVideo) => item.bvid, [])

	const renderContent = () => {
		if (isLoading) {
			return (
				<View style={styles.centerContainer}>
					<ActivityIndicator size={'large'} />
				</View>
			)
		}
		if (allVideos.length > 0) {
			return (
				<FlashList
					data={allVideos}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					extraData={extraData}
					onEndReached={() => {
						if (hasNextPage && !isFetchingNextPage) {
							void fetchNextPage()
						}
					}}
					onEndReachedThreshold={0.5}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View style={{ padding: 16 }}>
								<ActivityIndicator />
							</View>
						) : null
					}
				/>
			)
		}
		return (
			<View style={styles.centerContainer}>
				<Text style={styles.centerText}>没有找到匹配的视频</Text>
			</View>
		)
	}

	return (
		<>
			<Dialog.Title>手动匹配视频</Dialog.Title>
			<Dialog.Content>
				<Searchbar
					value={query}
					onChangeText={setQuery}
					placeholder='输入关键词搜索'
					onSubmitEditing={() => setFinalQuery(query)}
				/>
			</Dialog.Content>
			<Dialog.ScrollArea style={styles.scrollArea}>
				{renderContent()}
			</Dialog.ScrollArea>
			<Dialog.Actions>
				<Button onPress={() => close('ManualMatchExternalSync')}>取消</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	searchItem: {
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	searchItemContent: {
		flexDirection: 'column',
		marginLeft: 12,
		flex: 1,
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	centerText: {
		textAlign: 'center',
	},
	scrollArea: {
		height: 300,
		paddingHorizontal: 0,
	},
})
