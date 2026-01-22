import FunctionalMenu from '@/components/common/FunctionalMenu'
import { useBatchDownloadStatus } from '@/hooks/player/useBatchDownloadStatus'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import { getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'
import { DownloadState, Orpheus } from '@roitium/expo-orpheus'
import { useRouter } from 'expo-router'
import { Dimensions } from 'react-native'
import { Divider, Menu } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const screenWidth = Dimensions.get('window').width

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

	return (
		<FunctionalMenu
			visible={menuVisible}
			onDismiss={() => setMenuVisible(false)}
			anchor={{ x: screenWidth - 24, y: insets.top + 24 }}
		>
			{currentTrack?.source === 'bilibili' && (
				<Menu.Item
					onPress={() => {
						setMenuVisible(false)
						openModal('AddVideoToBilibiliFavorite', {
							bvid: currentTrack.bilibiliMetadata.bvid,
						})
					}}
					title='添加到 bilibili 收藏夹'
					leadingIcon='playlist-plus'
				/>
			)}
			<Menu.Item
				onPress={() => {
					setMenuVisible(false)
					if (!currentTrack) return
					openModal('UpdateTrackLocalPlaylists', { track: currentTrack })
				}}
				title='添加到本地歌单'
				leadingIcon='playlist-plus'
			/>
			<Menu.Item
				onPress={() => {
					setMenuVisible(false)
					if (!uploaderMid) {
						toast.error('获取视频详细信息失败')
					} else {
						router.push({
							pathname: '/playlist/remote/uploader/[mid]',
							params: { mid: String(uploaderMid) },
						})
					}
				}}
				title='查看作者'
				leadingIcon='account-music'
			/>
			<Divider />
			{currentTrack?.source === 'bilibili' && (
				<Menu.Item
					onPress={() => {
						setMenuVisible(false)
						if (!currentTrack) return
						router.push({
							pathname: '/playlist/remote/multipage/[bvid]',
							params: { bvid: currentTrack.bilibiliMetadata.bvid },
						})
					}}
					title='查看视频详情'
					leadingIcon='open-in-new'
				/>
			)}
			<Menu.Item
				onPress={async () => {
					if (!currentTrack) {
						setMenuVisible(false)
						toast.error('为什么 currentTrack 不存在？')
						return
					}
					setMenuVisible(false)
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
				}}
				title={
					downloadStatus?.[currentTrack?.uniqueKey ?? ''] ===
					DownloadState.COMPLETED
						? '重新下载音频'
						: '下载音频'
				}
				leadingIcon='download'
			/>
			<Menu.Item
				onPress={() => {
					setMenuVisible(false)
					if (!currentTrack) return
					openModal('ManualSearchLyrics', {
						uniqueKey: currentTrack.uniqueKey,
						initialQuery: currentTrack.title,
					})
				}}
				title='搜索歌词'
				leadingIcon='magnify'
			/>
			<Menu.Item
				onPress={() => {
					setMenuVisible(false)
					openModal('PlaybackSpeed', undefined)
				}}
				title='播放速度'
				leadingIcon='speedometer'
			/>
			<Menu.Item
				onPress={() => {
					setMenuVisible(false)
					openModal('SleepTimer', undefined)
				}}
				title='定时关闭'
				leadingIcon='timer-outline'
			/>
		</FunctionalMenu>
	)
}
