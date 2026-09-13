import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useCallback, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Icon, List, Text, TouchableRipple, useTheme } from 'react-native-paper'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useBatchDownloadStatus } from '@/hooks/queries/orpheus'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { switchPlayerMode } from '@/lib/player/playbackSession'
import { toastAndLogError } from '@/utils/error-handling'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

export interface PlayerMenuContentProps {
	onAction: (action: () => void) => void
}

export function HighFreqRow({
	children,
	style,
}: {
	children: ReactNode
	style?: StyleProp<ViewStyle>
}) {
	return (
		<View
			style={[
				{
					flexDirection: 'row',
					paddingHorizontal: 12,
					width: '100%',
				},
				style,
			]}
		>
			{children}
		</View>
	)
}

export function HighFreqButton({
	icon,
	label,
	onPress,
}: {
	icon: string
	label: string
	onPress: () => void
}) {
	const { colors } = useTheme()
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

export function PlayerDownloadButton({ onAction }: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const trackId = currentTrack?.uniqueKey
	const { data: downloadStatus } = useBatchDownloadStatus(
		trackId ? [trackId] : [],
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
		<HighFreqButton
			icon='download'
			label={
				downloadStatus?.[trackId ?? ''] === DownloadState.COMPLETED
					? '重新下载'
					: '下载'
			}
			onPress={() => onAction(downloadHandler)}
		/>
	)
}

export function SharedTrackActions({
	onAction: handleAction,
}: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)
	const uploaderMid = Number(currentTrack?.artist?.remoteId ?? undefined)
	return (
		<>
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
				title='编辑信息'
				left={(props) => (
					<List.Icon
						{...props}
						icon='pencil'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						openModal('EditTrackMetadata', { track: currentTrack })
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
		</>
	)
}

export function ShareSongAction({
	onAction: handleAction,
}: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)
	return (
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
	)
}

export function PlayerModeSwitch({ onAction }: PlayerMenuContentProps) {
	return (
		<List.Item
			title='切换播放器模式'
			left={(props) => (
				<List.Icon
					{...props}
					icon='swap-horizontal'
				/>
			)}
			onPress={() => {
				const currentMode = playbackContextStore$.context.mode.peek()
				if (!currentMode) return
				const mode = currentMode === 'podcast' ? 'music' : 'podcast'
				const label = mode === 'podcast' ? '播客' : '音乐'
				onAction(() =>
					useModalStore.getState().open('Alert', {
						title: `切换到${label}模式？`,
						message: `仅在本次播放中使用${label}模式，不会更改歌单偏好或默认设置。重新开始播放时，将按歌单偏好或默认设置选择模式。`,
						buttons: [
							{ text: '取消' },
							{
								text: '切换',
								onPress: () => {
									void switchPlayerMode(mode).catch((error: unknown) =>
										toastAndLogError('更新播放设置失败', error, 'Player.Mode'),
									)
								},
							},
						],
					}),
				)
			}}
		/>
	)
}
