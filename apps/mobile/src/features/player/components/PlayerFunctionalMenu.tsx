import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { ScrollView, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import {
	Divider,
	Icon,
	List,
	MD3Theme,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBatchDownloadStatus } from '@/hooks/player/useBatchDownloadStatus'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

function HighFreqButton({
	icon,
	label,
	onPress,
	colors,
}: {
	icon: string
	label: string
	onPress: () => void
	colors: MD3Theme['colors']
}) {
	return (
		<SquircleView
			style={{
				borderRadius: 20,
				overflow: 'hidden',
				backgroundColor: colors.elevation.level2,
				flex: 1,
				marginHorizontal: 4,
			}}
			cornerSmoothing={0.6}
		>
			<TouchableRipple
				onPress={onPress}
				style={{ flex: 1 }}
			>
				<View
					style={{
						alignItems: 'center',
						justifyContent: 'center',
						paddingVertical: 16,
						height: 80,
					}}
				>
					<Icon
						source={icon}
						size={28}
					/>
					<Text
						variant='labelMedium'
						style={{ marginTop: 8 }}
					>
						{label}
					</Text>
				</View>
			</TouchableRipple>
		</SquircleView>
	)
}

export function PlayerFunctionalMenu({
	menuVisible,
	setMenuVisible,
}: {
	menuVisible: boolean
	setMenuVisible: (visible: boolean) => void
}) {
	const router = useRouter()
	const currentTrack = useCurrentTrack()
	const insets = useSafeAreaInsets()
	const openModal = useModalStore((state) => state.open)
	const uploaderMid = Number(currentTrack?.artist?.remoteId ?? undefined)
	const trackId = currentTrack?.uniqueKey
	const { data: downloadStatus } = useBatchDownloadStatus(
		trackId ? [trackId] : [],
	)
	const colors = useTheme().colors
	const sheetRef = useRef<TrueSheet>(null)

	const isPresented = useRef(false)

	useEffect(() => {
		if (menuVisible) {
			sheetRef.current?.present().catch(() => {
				// Ignore error
			})
		} else {
			if (isPresented.current) {
				sheetRef.current?.dismiss().catch(() => {
					// Ignore error
				})
			}
		}
	}, [menuVisible])

	const onDismiss = useCallback(() => {
		isPresented.current = false
		setMenuVisible(false)
	}, [setMenuVisible])

	const onPresent = useCallback(() => {
		isPresented.current = true
		if (!menuVisible) {
			sheetRef.current?.dismiss().catch(() => {
				// Ignore error
			})
		}
	}, [menuVisible])

	const handleAction = useCallback(
		(action: () => void) => {
			setMenuVisible(false)
			action()
		},
		[setMenuVisible],
	)

	const downloadHandler = useCallback(async () => {
		if (!currentTrack) {
			toast.error('为什么 currentTrack 不存在？')
			return
		}
		const url = getInternalPlayUri(currentTrack)
		if (!url) {
			toast.error('获取内部播放地址失败')
			return
		}
		const artistName = currentTrack.artist?.name
		const artworkUrl = currentTrack.coverUrl ?? undefined
		try {
			await Orpheus.downloadTrack({
				id: currentTrack.uniqueKey,
				url: url,
				title: currentTrack.title,
				artist: artistName,
				artwork: artworkUrl,
				duration: currentTrack.duration,
			})
			toast.success('已添加到下载队列')
		} catch (e) {
			toastAndLogError(
				'下载音频失败',
				e,
				'Features.Player.PlayerFunctionalMenu',
			)
		}
	}, [currentTrack])

	return (
		<TrueSheet
			ref={sheetRef}
			detents={['auto']}
			cornerRadius={24}
			backgroundColor={colors.elevation.level1}
			onDidDismiss={onDismiss}
			onDidPresent={onPresent}
		>
			<ScrollView
				style={{ maxHeight: '100%', marginTop: 16 }}
				contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
			>
				<View
					style={{
						flexDirection: 'row',
						paddingHorizontal: 12,
						paddingTop: 16,
						paddingBottom: 24,
						width: '100%',
					}}
				>
					<HighFreqButton
						icon='speedometer'
						label='倍速'
						onPress={() =>
							handleAction(() => openModal('PlaybackSpeed', undefined))
						}
						colors={colors}
					/>
					<HighFreqButton
						icon='timer-outline'
						label='定时关闭'
						onPress={() =>
							handleAction(() => openModal('SleepTimer', undefined))
						}
						colors={colors}
					/>
					<HighFreqButton
						icon='download'
						label={
							downloadStatus?.[currentTrack?.uniqueKey ?? ''] ===
							DownloadState.COMPLETED
								? '重新下载'
								: '下载'
						}
						onPress={() => handleAction(downloadHandler)}
						colors={colors}
					/>
				</View>

				<Divider />

				<View style={{ paddingTop: 8 }}>
					{currentTrack?.source === 'bilibili' && (
						<List.Item
							title='添加到 bilibili 收藏夹'
							left={(props) => (
								<List.Icon
									{...props}
									icon='playlist-plus'
								/>
							)}
							onPress={() =>
								handleAction(() => {
									if (!currentTrack) return
									openModal('AddVideoToBilibiliFavorite', {
										bvid: currentTrack.bilibiliMetadata.bvid,
									})
								})
							}
						/>
					)}
					<List.Item
						title='添加到本地歌单'
						left={(props) => (
							<List.Icon
								{...props}
								icon='playlist-plus'
							/>
						)}
						onPress={() =>
							handleAction(() => {
								if (!currentTrack) return
								openModal('UpdateTrackLocalPlaylists', { track: currentTrack })
							})
						}
					/>
					<List.Item
						title='查看作者'
						left={(props) => (
							<List.Icon
								{...props}
								icon='account-music'
							/>
						)}
						onPress={() =>
							handleAction(() => {
								if (!uploaderMid) {
									toast.error('获取视频详细信息失败')
								} else {
									router.push({
										pathname: '/playlist/remote/uploader/[mid]',
										params: { mid: String(uploaderMid) },
									})
								}
							})
						}
					/>
					{currentTrack?.source === 'bilibili' && (
						<List.Item
							title='查看视频详情'
							left={(props) => (
								<List.Icon
									{...props}
									icon='open-in-new'
								/>
							)}
							onPress={() =>
								handleAction(() => {
									if (!currentTrack) return
									router.push({
										pathname: '/playlist/remote/multipage/[bvid]',
										params: { bvid: currentTrack.bilibiliMetadata.bvid },
									})
								})
							}
						/>
					)}
					<List.Item
						title='搜索歌词'
						left={(props) => (
							<List.Icon
								{...props}
								icon='magnify'
							/>
						)}
						onPress={() =>
							handleAction(() => {
								if (!currentTrack) return
								openModal('ManualSearchLyrics', {
									uniqueKey: currentTrack.uniqueKey,
									initialQuery: currentTrack.title,
								})
							})
						}
					/>
					<List.Item
						title='分享歌词'
						left={(props) => (
							<List.Icon
								{...props}
								icon='share-variant'
							/>
						)}
						onPress={() =>
							handleAction(() => {
								if (!currentTrack) return
								openModal('LyricsSelection', undefined)
							})
						}
					/>
					<List.Item
						title='分享歌曲'
						left={(props) => (
							<List.Icon
								{...props}
								icon='share-variant-outline'
							/>
						)}
						onPress={() =>
							handleAction(() => {
								if (!currentTrack) return
								openModal('SongShare', undefined)
							})
						}
					/>
				</View>
			</ScrollView>
		</TrueSheet>
	)
}
