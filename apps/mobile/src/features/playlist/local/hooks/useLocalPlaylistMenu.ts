import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'

import { alert } from '@/components/modals/AlertModal'
import type { TrackMenuItem } from '@/features/playlist/local/components/LocalPlaylistItem'
import { queryClient } from '@/lib/config/queryClient'
import type { Playlist, Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { convertToOrpheusTrack, getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

const SCOPE = 'UI.Playlist.Local.Menu'

interface LocalPlaylistMenuProps {
	deleteTrack: (trackId: number) => void
	openAddToPlaylistModal: (track: Track) => void
	openEditTrackModal: (track: Track) => void
	playlist: Playlist
}

export function useLocalPlaylistMenu({
	deleteTrack,
	openAddToPlaylistModal,
	openEditTrackModal,
	playlist,
}: LocalPlaylistMenuProps) {
	const router = useRouter()

	const playNext = useCallback(async (track: Track) => {
		try {
			const oTrack = convertToOrpheusTrack(track)
			if (oTrack.isErr()) {
				toastAndLogError('转换 Track 失败', oTrack.error, SCOPE)
				return
			}
			await Orpheus.playNext(oTrack.value)
			toast.success('添加到下一首播放成功')
		} catch (error) {
			toastAndLogError('添加到队列失败', error, SCOPE)
		}
	}, [])

	const menuFunctions = (
		item: Track,
		downloadState?: DownloadState,
	): TrackMenuItem[] => {
		const menuItems: TrackMenuItem[] = [
			{
				title: '下一首播放',
				leadingIcon: 'skip-next-circle-outline',
				onPress: () => playNext(item),
				isHighFreq: true,
			},
			{
				title: '添加到本地歌单',
				leadingIcon: 'playlist-plus',
				onPress: () => openAddToPlaylistModal(item),
				isHighFreq: true,
			},
		]
		if (item.source === 'bilibili') {
			menuItems.push(
				{
					title: '查看详细信息',
					leadingIcon: 'file-document-outline',
					onPress: () =>
						router.push({
							pathname: '/playlist/remote/multipage/[bvid]',
							params: { bvid: item.bilibiliMetadata.bvid },
						}),
				},
				{
					title: '查看 up 主作品',
					leadingIcon: 'account-music',
					onPress: () => {
						if (!item.artist?.remoteId) {
							return
						}
						router.push({
							pathname: '/playlist/remote/uploader/[mid]',
							params: { mid: item.artist?.remoteId },
						})
					},
				},
				{
					title:
						downloadState === DownloadState.COMPLETED ? '删除缓存' : '缓存音频',
					leadingIcon:
						downloadState === DownloadState.COMPLETED
							? 'delete-sweep'
							: 'download',
					onPress: async () => {
						if (downloadState === DownloadState.COMPLETED) {
							await Orpheus.removeDownload(item.uniqueKey)
							toast.success('删除缓存成功')
							await queryClient.invalidateQueries({
								queryKey: ['batchDownloadStatus'],
							})
							return
						}
						const url = getInternalPlayUri(item)
						if (!url) {
							toastAndLogError(
								'获取内部播放地址失败',
								'失败了！',
								'UI.Playlist.Local.Menu',
							)
							return
						}

						await Orpheus.downloadTrack({
							id: item.uniqueKey,
							url: url,
							title: item.title,
							artist: item.artist?.name ?? 'Unknown',
							artwork: item.coverUrl ?? '',
							duration: item.duration,
						})

						toast.success('已开始下载')
					},
					isHighFreq: true,
				},
			)
		}
		menuItems.push(
			{
				title: '复制封面链接',
				leadingIcon: 'link',
				onPress: () => {
					void Clipboard.setStringAsync(item.coverUrl ?? '')
					toast.success('已复制到剪贴板')
				},
			},
			{
				title: '改名',
				leadingIcon: 'pencil',
				onPress: () => openEditTrackModal(item),
			},
		)
		if (playlist?.type === 'local') {
			menuItems.push({
				title: '删除歌曲',
				leadingIcon: 'playlist-remove',
				onPress: () =>
					alert(
						'确定？',
						'确定从列表中移除该歌曲？',
						[
							{
								text: '取消',
							},
							{
								text: '确定',
								onPress: () => deleteTrack(item.id),
							},
						],
						{
							cancelable: true,
						},
					),
				danger: true,
			})
		}
		return menuItems
	}

	return menuFunctions
}
