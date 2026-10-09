import {
	Orpheus,
	PlaybackState,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import { LegendList } from '@legendapp/list/react-native'
import { decode } from 'he'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TouchableRipple, useTheme } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import IconButton from '@/components/common/IconButton'
import { useSearchResults } from '@/hooks/queries/bilibili/search'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { isBilibiliRateLimitError } from '@/lib/errors/thirdparty/bilibili'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import { getTrackFingerprint } from '@/lib/services/externalPlaylistService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { BilibiliTrack } from '@/types/core/media'
import type { GenericTrack } from '@/types/external_playlist'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import { toastAndLogError } from '@/utils/error-handling'
import { addToQueue } from '@/utils/player'
import { formatDurationToHHMMSS, parseDurationString } from '@/utils/time'

function mapSearchVideoToBilibiliTrack(
	item: BilibiliSearchVideo,
): BilibiliTrack {
	const coverUrl = item.pic
		? item.pic.startsWith('//')
			? `https:${item.pic}`
			: item.pic
		: null
	const cleanTitle = item.title.replace(/<em[^>]*>|<\/em>/g, '')
	const timestamp = item.senddate ? item.senddate * 1000 : Date.now()
	return {
		id: item.aid || 0,
		uniqueKey: `bilibili::${item.bvid}`,
		source: 'bilibili',
		title: cleanTitle,
		artist: {
			id: item.mid || 0,
			name: item.author || '未知 UP 主',
			remoteId: String(item.mid || `bili_up_${item.author || 'unknown'}`),
			source: 'bilibili',
			createdAt: new Date(timestamp),
			updatedAt: new Date(timestamp),
		},
		coverUrl,
		duration: item.duration ? parseDurationString(item.duration) : 0,
		createdAt: new Date(timestamp),
		updatedAt: new Date(timestamp),
		titleHtml: item.title,
		bilibiliMetadata: {
			bvid: item.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

interface SearchItemExtraData {
	handlePressItem: (item: BilibiliSearchVideo) => void
	handleToggleAudition: (item: BilibiliSearchVideo) => void
	activeBvid: string | null
}

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	BilibiliSearchVideo,
	SearchItemExtraData
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	return (
		<SearchItem
			item={item}
			isAuditioning={extraData.activeBvid === item.bvid}
			onPress={extraData.handlePressItem}
			onToggleAudition={extraData.handleToggleAudition}
		/>
	)
}

const SearchItem = memo(function SearchItem({
	item,
	isAuditioning,
	onPress,
	onToggleAudition,
}: {
	item: BilibiliSearchVideo
	isAuditioning: boolean
	onPress: (item: BilibiliSearchVideo) => void
	onToggleAudition: (item: BilibiliSearchVideo) => void
}) {
	const theme = useTheme()
	const coverUrl = item.pic.startsWith('//') ? `https:${item.pic}` : item.pic
	const cleanTitle = item.title.replace(/<em[^>]*>|<\/em>/g, '')
	const durationSec = item.duration ? parseDurationString(item.duration) : 0

	return (
		<View style={styles.itemRow}>
			<TouchableRipple
				style={styles.searchItem}
				onPress={() => onPress(item)}
			>
				<View style={styles.itemContainer}>
					<CoverWithPlaceHolder
						id={item.bvid}
						cover={coverUrl}
						size={40}
						title={cleanTitle}
					/>
					<View style={styles.searchItemContent}>
						<Text
							variant='bodyMedium'
							numberOfLines={1}
						>
							{cleanTitle}
						</Text>
						<Text
							variant='bodySmall'
							numberOfLines={1}
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{item.author} · {formatDurationToHHMMSS(durationSec)}
						</Text>
					</View>
				</View>
			</TouchableRipple>
			<IconButton
				icon={isAuditioning ? 'stop' : 'play'}
				size={20}
				mode={isAuditioning ? 'contained' : 'contained-tonal'}
				iconColor={
					isAuditioning ? theme.colors.onPrimary : theme.colors.primary
				}
				containerColor={
					isAuditioning ? theme.colors.primary : theme.colors.secondaryContainer
				}
				onPress={() => onToggleAudition(item)}
				style={styles.auditionButton}
			/>
		</View>
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
	const [loadingBvid, setLoadingBvid] = useState<string | null>(null)
	const loadingBvidRef = useRef<string | null>(null)
	const auditionedKeyRef = useRef<string | null>(null)
	const close = useModalStore((state) => state.close)

	const isPlaying = useIsPlaying()
	const playbackState = usePlaybackState()
	const currentOrpheusTrackId = usePlayerStore(
		(state) => state.orpheusTrack?.id,
	)

	const activeBvid = useMemo(() => {
		if (loadingBvid) return loadingBvid
		if (
			currentOrpheusTrackId?.startsWith('bilibili::') &&
			(isPlaying || playbackState === PlaybackState.BUFFERING)
		) {
			return currentOrpheusTrackId.slice('bilibili::'.length)
		}
		return null
	}, [currentOrpheusTrackId, isPlaying, loadingBvid, playbackState])

	useEffect(() => {
		return () => {
			loadingBvidRef.current = null
			if (auditionedKeyRef.current) {
				auditionedKeyRef.current = null
				void Orpheus.pause()
			}
		}
	}, [])

	const {
		data,
		isLoading,
		isError,
		error,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useSearchResults(finalQuery)

	const allVideos = useMemo(() => {
		if (!data?.pages) {
			return []
		}

		const allTracks = data.pages.flatMap((page) => page.result)
		const uniqueMap = new Map(
			allTracks.map((t) => [
				t.bvid,
				{
					...t,
					title: decode(t.title),
				},
			]),
		)
		return [...uniqueMap.values()]
	}, [data])

	const handleToggleAudition = useCallback(
		async (video: BilibiliSearchVideo) => {
			const targetKey = `bilibili::${video.bvid}`
			const isCurrent = usePlayerStore.getState().orpheusTrack?.id === targetKey
			const currentlyPlaying = await Orpheus.getIsPlaying()

			if (
				loadingBvidRef.current === video.bvid ||
				(isCurrent && (currentlyPlaying || isPlaying))
			) {
				loadingBvidRef.current = null
				setLoadingBvid(null)
				auditionedKeyRef.current = null
				await Orpheus.pause()
				return
			}

			if (isCurrent && !currentlyPlaying) {
				auditionedKeyRef.current = targetKey
				await Orpheus.play()
				return
			}

			loadingBvidRef.current = video.bvid
			setLoadingBvid(video.bvid)
			try {
				const biliTrack = mapSearchVideoToBilibiliTrack(video)
				const createResult = await syncFacade.addTrackToLocal(biliTrack)
				if (createResult.isErr()) {
					toastAndLogError(
						'加载试听音源失败',
						createResult.error,
						'UI.Modal.ManualMatchExternalSync',
					)
					return
				}
				if (loadingBvidRef.current !== video.bvid) {
					return
				}
				auditionedKeyRef.current = biliTrack.uniqueKey
				await addToQueue({
					tracks: [biliTrack],
					playNow: true,
					clearQueue: false,
					playNext: false,
					startFromKey: biliTrack.uniqueKey,
				})
			} finally {
				if (loadingBvidRef.current === video.bvid) {
					loadingBvidRef.current = null
					setLoadingBvid(null)
				}
			}
		},
		[isPlaying],
	)

	const handlePressItem = useCallback(
		(video: BilibiliSearchVideo) => {
			loadingBvidRef.current = null
			if (auditionedKeyRef.current) {
				auditionedKeyRef.current = null
				void Orpheus.pause()
			}
			onMatch({
				track,
				matchedVideo: video,
				status: 'matched',
				trackFingerprint: getTrackFingerprint(track),
			})
			close('ManualMatchExternalSync')
		},
		[close, onMatch, track],
	)

	const extraData = useMemo<SearchItemExtraData>(
		() => ({
			handlePressItem,
			handleToggleAudition: (video: BilibiliSearchVideo) => {
				void handleToggleAudition(video)
			},
			activeBvid,
		}),
		[activeBvid, handlePressItem, handleToggleAudition],
	)

	const keyExtractor = useCallback((item: BilibiliSearchVideo) => item.bvid, [])

	const renderContent = () => {
		if (isLoading) {
			return (
				<View style={styles.centerContainer}>
					<ActivityIndicator size={'large'} />
				</View>
			)
		}
		if (isError && allVideos.length === 0) {
			return (
				<View style={styles.centerContainer}>
					<Text style={styles.centerText}>
						{isBilibiliRateLimitError(error)
							? '请求暂时受限，进度已保存，请稍后再试'
							: `搜索失败: ${error instanceof Error ? error.message : '请稍后重试'}`}
					</Text>
				</View>
			)
		}
		if (allVideos.length > 0) {
			return (
				<LegendList
					data={allVideos}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					extraData={extraData}
					recycleItems
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
				<SearchBar
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
				<Button
					onPress={() => {
						loadingBvidRef.current = null
						if (auditionedKeyRef.current) {
							auditionedKeyRef.current = null
							void Orpheus.pause()
						}
						close('ManualMatchExternalSync')
					}}
				>
					取消
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingRight: 8,
	},
	searchItem: {
		flex: 1,
		paddingVertical: 8,
		paddingLeft: 16,
		paddingRight: 8,
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
	auditionButton: {
		margin: 0,
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
