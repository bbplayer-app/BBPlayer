import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { PlaylistLoading } from '@/features/playlist/remote/components/PlaylistLoading'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import {
	useInfiniteGetUserUploadedVideos,
	useOtherUserInfo,
} from '@/hooks/queries/bilibili/user'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDebouncedValue } from '@/hooks/utils/useDebouncedValue'
import { bv2av } from '@/lib/api/bilibili/utils'
import type {
	BilibiliUserInfo,
	BilibiliUserUploadedVideosResponse,
} from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { formatMMSSToSeconds } from '@/utils/time'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { Appbar, Button, Searchbar, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

const SEARCHBAR_HEIGHT = 72

const mapApiItemToTrack = (
	apiItem: BilibiliUserUploadedVideosResponse['list']['vlist'][0],
	uploaderData: BilibiliUserInfo,
): BilibiliTrack => {
	return {
		id: bv2av(apiItem.bvid),
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title,
		artist: {
			id: uploaderData.mid,
			name: uploaderData.name,
			avatarUrl: uploaderData.face,
			source: 'bilibili',
			remoteId: uploaderData.mid.toString(),
			createdAt: new Date(apiItem.created),
			updatedAt: new Date(apiItem.created),
		},
		coverUrl: apiItem.pic,
		duration: formatMMSSToSeconds(apiItem.length),
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
		createdAt: new Date(apiItem.created),
		updatedAt: new Date(apiItem.created),
		trackDownloads: null,
	}
}

export default function UploaderPage() {
	const { mid } = useLocalSearchParams<{ mid: string }>()
	const { colors } = useTheme()
	const router = useRouter()
	const [refreshing, setRefreshing] = useState(false)
	const enable = useAppStore((state) => state.hasBilibiliCookie())

	const { selected, selectMode, toggle, enterSelectMode, exitSelectMode } =
		useTrackSelection()

	const [searchQuery, setSearchQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const searchbarHeight = useSharedValue(0)
	const debouncedQuery = useDebouncedValue(searchQuery, 200)
	const openModal = useModalStore((state) => state.open)

	const searchbarAnimatedStyle = useAnimatedStyle(() => ({
		height: searchbarHeight.value,
	}))

	useEffect(() => {
		searchbarHeight.set(
			withTiming(startSearch ? SEARCHBAR_HEIGHT : 0, { duration: 180 }),
		)
	}, [searchbarHeight, startSearch])

	const {
		data: uploadedVideos,
		isPending: isUploadedVideosPending,
		isError: isUploadedVideosError,
		fetchNextPage,
		refetch,
		hasNextPage,
	} = useInfiniteGetUserUploadedVideos(Number(mid), debouncedQuery)

	const {
		data: uploaderUserInfo,
		isPending: isUserInfoPending,
		isError: isUserInfoError,
	} = useOtherUserInfo(Number(mid))

	const tracks = useMemo(() => {
		if (!uploadedVideos || !uploaderUserInfo) return []
		return uploadedVideos.pages
			.flatMap((page) => page.list.vlist)
			.map((item) => mapApiItemToTrack(item, uploaderUserInfo))
	}, [uploadedVideos, uploaderUserInfo])

	const { playTrack } = useRemotePlaylist()

	const trackMenuItems = usePlaylistMenu(playTrack)

	useEffect(() => {
		if (typeof mid !== 'string') {
			router.replace('/not-found')
		}
	}, [mid, router])

	usePreventRemove(startSearch || selectMode, () => {
		if (startSearch) setStartSearch(false)
		if (selectMode) exitSelectMode()
	})

	if (typeof mid !== 'string') {
		return null
	}

	if (!enable) {
		return (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.background,
					gap: 16,
					paddingHorizontal: 25,
				}}
			>
				<Text
					variant='titleMedium'
					style={{ textAlign: 'center' }}
				>
					登录 bilibili 账号后才能查看 up 主作品
					{'\n\n'}
					为什么：bilibili
					对访问用户个人空间和上传的视频接口有莫名其妙的风控校验
				</Text>
				<Button
					mode='contained'
					onPress={() => {
						openModal('QRCodeLogin', undefined)
					}}
				>
					登录
				</Button>
			</View>
		)
	}

	if (isUserInfoPending) {
		return <PlaylistLoading />
	}

	if (isUploadedVideosPending && !startSearch) {
		return <PlaylistLoading />
	}

	if (isUploadedVideosError || isUserInfoError) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<Appbar.Header elevated>
				<Appbar.Content
					title={
						selectMode ? `已选择 ${selected.size} 首` : uploaderUserInfo.name
					}
				/>
				<Appbar.BackAction onPress={() => router.back()} />
				{selectMode ? (
					<Appbar.Action
						icon='playlist-plus'
						onPress={() => {
							const payloads = []
							for (const id of selected) {
								const track = tracks.find((t) => t.id === id)
								if (track) {
									payloads.push({
										track: track as Track,
										artist: track.artist!,
									})
								}
							}
							openModal('BatchAddTracksToLocalPlaylist', {
								payloads,
							})
						}}
					/>
				) : (
					<Appbar.Action
						icon={startSearch ? 'close' : 'magnify'}
						onPress={() => setStartSearch((prev) => !prev)}
					/>
				)}
			</Appbar.Header>

			{/* 搜索框 */}
			<Animated.View style={[{ overflow: 'hidden' }, searchbarAnimatedStyle]}>
				<Searchbar
					mode='view'
					placeholder='搜索歌曲'
					onChangeText={setSearchQuery}
					value={searchQuery}
				/>
			</Animated.View>

			<View
				style={{
					flex: 1,
				}}
			>
				<TrackList
					tracks={tracks ?? []}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selectMode={selectMode}
					selected={selected}
					toggle={toggle}
					enterSelectMode={enterSelectMode}
					ListHeaderComponent={
						<PlaylistHeader
							coverUri={uploaderUserInfo.face}
							title={uploaderUserInfo.name}
							subtitles={`${uploadedVideos?.pages[0].page.count ?? 0} 首歌曲`}
							description={uploaderUserInfo.sign}
							onClickMainButton={undefined}
							mainButtonIcon={'sync'}
							id={Number(mid)}
						/>
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true)
								await refetch()
								setRefreshing(false)
							}}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					hasNextPage={hasNextPage}
				/>
			</View>
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
