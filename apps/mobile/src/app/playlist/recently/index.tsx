import { useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Appbar, Text, useTheme } from 'react-native-paper'

import NowPlayingBar from '@/components/NowPlayingBar'
import { PlaylistError } from '@/features/playlist/local/components/PlaylistError'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { usePlaylistMenu } from '@/features/playlist/remote/hooks/usePlaylistMenu'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { useMostPlayedTracks } from '@/hooks/queries/playHistory'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

export default function RecentlyPlayedPage() {
	const router = useRouter()
	const theme = useTheme()
	const { colors } = theme

	const {
		backgroundColor,
		nowPlayingBarColor,
		primaryButtonColor,
		primaryButtonTextColor,
		secondaryButtonContainerColor,
		secondaryButtonIconColor,
	} = usePlaylistBackgroundColor(null, theme.dark, colors.background)

	const { selected, selectMode, toggle, enterSelectMode } = useTrackSelection()
	const selection = useMemo(
		() => ({
			active: selectMode,
			selected,
			toggle,
			enter: enterSelectMode,
		}),
		[selectMode, selected, toggle, enterSelectMode],
	)

	const { data: tracksData, isPending, isError } = useMostPlayedTracks(14, 10)

	const tracks = useMemo(() => {
		if (!tracksData) return []
		return tracksData.map((item) => item.track)
	}, [tracksData])

	const playTrack = useCallback(
		async (track: BilibiliTrack, playNext: boolean) => {
			await addToQueue({
				tracks: [track],
				playNow: false,
				clearQueue: false,
				playNext: playNext,
			})
		},
		[],
	)

	const handlePlay = useCallback(async (track: Track) => {
		await addToQueue({
			tracks: [track],
			playNow: true,
			clearQueue: false,
			startFromKey: track.uniqueKey,
			playNext: false,
		})
	}, [])

	const handlePlayAll = useCallback(async () => {
		if (!tracksData) {
			toast.error('没有可播放的歌曲')
			return
		}
		const tracks = tracksData.map((item) => item.track)
		await addToQueue({
			tracks,
			playNow: true,
			clearQueue: true,
			playNext: false,
		})
	}, [tracksData])

	const trackMenuItems = usePlaylistMenu(playTrack)

	const bilibiliTracks = useMemo(() => {
		return tracks as BilibiliTrack[]
	}, [tracks])

	if (isPending) {
		return <PlaylistPageSkeleton />
	}

	if (isError) {
		return <PlaylistError text='加载失败' />
	}

	const isEmpty = !tracksData || tracksData.length === 0

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='最近常听' />
			</Appbar.Header>

			<View style={styles.listContainer}>
				{isEmpty ? (
					<View style={styles.emptyContainer}>
						<Text variant='bodyLarge'>暂无播放记录</Text>
					</View>
				) : (
					<TrackList
						tracks={bilibiliTracks}
						playTrack={handlePlay}
						trackMenuItems={trackMenuItems}
						selection={selection}
						ListHeaderComponent={
							<PlaylistHeader
								title='最近常听'
								subtitles='最近14天最常播放的歌曲'
								description={undefined}
								mainButtonIcon='play'
								mainButtonText='播放全部'
								id='recently-played'
								onClickMainButton={handlePlayAll}
								primaryButtonColor={primaryButtonColor}
								primaryButtonTextColor={primaryButtonTextColor}
								secondaryButtonContainerColor={secondaryButtonContainerColor}
								secondaryButtonIconColor={secondaryButtonIconColor}
							/>
						}
					/>
				)}
			</View>

			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar backgroundColor={nowPlayingBarColor} />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContainer: {
		flex: 1,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
