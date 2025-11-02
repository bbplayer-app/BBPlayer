import FunctionalMenu from '@/components/common/FunctionalMenu'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useDownloadManagerStore from '@/hooks/stores/useDownloadManagerStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
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
	const download = useDownloadManagerStore((state) => state.queueDownloads)
	const uploaderMid = Number(currentTrack?.artist?.remoteId ?? undefined)

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
						WebBrowser.openBrowserAsync(
							`https://www.bilibili.com/video/${currentTrack.bilibiliMetadata.bvid}`,
						).catch((e) => {
							void Clipboard.setStringAsync(
								`https://www.bilibili.com/video/${currentTrack.bilibiliMetadata.bvid}`,
							)
							toast.error('无法调用浏览器打开网页，已将链接复制到剪贴板', {
								description: String(e),
							})
						})
					}}
					title='查看原视频'
					leadingIcon='share-variant'
				/>
			)}
			<Menu.Item
				onPress={() => {
					if (!currentTrack) {
						setMenuVisible(false)
						toast.error('为什么 currentTrack 不存在？')
						return
					}
					setMenuVisible(false)
					download([
						{
							uniqueKey: currentTrack.uniqueKey,
							title: currentTrack.title,
							coverUrl: currentTrack.coverUrl ?? undefined,
						},
					])
					toast.info('已添加到下载队列')
				}}
				title={
					currentTrack?.trackDownloads?.status === 'downloaded'
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
					openModal('SleepTimer', undefined)
				}}
				title='定时关闭'
				leadingIcon='timer-outline'
			/>
		</FunctionalMenu>
	)
}
