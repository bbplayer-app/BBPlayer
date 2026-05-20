import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { Icon } from '@expo/ui'
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

const PLAY_NEXT_ICON = Icon.select({
	ios: 'arrow.right.to.line.circle',
	android: import('@expo/material-symbols/skip_next.xml'),
})

const ADD_TO_PLAYLIST_ICON = Icon.select({
	ios: 'plus.rectangle.on.rectangle',
	android: import('@expo/material-symbols/playlist_add.xml'),
})

const INFO_ICON = Icon.select({
	ios: 'doc.text',
	android: import('@expo/material-symbols/description.xml'),
})

const ARTIST_ICON = Icon.select({
	ios: 'person.crop.circle',
	android: import('@expo/material-symbols/person.xml'),
})

const DOWNLOAD_ICON = Icon.select({
	ios: 'arrow.down.circle',
	android: import('@expo/material-symbols/download.xml'),
})

const REMOVE_CACHE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete_sweep.xml'),
})

const LINK_ICON = Icon.select({
	ios: 'link',
	android: import('@expo/material-symbols/link.xml'),
})

const EDIT_ICON = Icon.select({
	ios: 'pencil',
	android: import('@expo/material-symbols/edit.xml'),
})

const DELETE_ICON = Icon.select({
	ios: 'trash',
	android: import('@expo/material-symbols/delete.xml'),
})

const SCOPE = 'UI.Playlist.Local.Menu'

interface LocalPlaylistMenuProps {
	deleteTrack: (trackId: number) => void
	openAddToPlaylistModal: (track: Track) => void
	openEditTrackModal: (track: Track) => void
	playlist: Playlist
	isReadOnly: boolean
}

export function useLocalPlaylistMenu({
	deleteTrack,
	openAddToPlaylistModal,
	openEditTrackModal,
	playlist,
	isReadOnly,
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
				leadingIcon: PLAY_NEXT_ICON,
				onPress: () => playNext(item),
				isHighFreq: true,
			},
			{
				title: '添加到本地歌单',
				leadingIcon: ADD_TO_PLAYLIST_ICON,
				onPress: () => openAddToPlaylistModal(item),
				isHighFreq: true,
			},
		]
		if (item.source === 'bilibili') {
			menuItems.push(
				{
					title: '查看详细信息',
					leadingIcon: INFO_ICON,
					onPress: () =>
						router.push({
							pathname: '/playlist/remote/multipage/[bvid]',
							params: { bvid: item.bilibiliMetadata.bvid },
						}),
				},
				{
					title: '查看 up 主作品',
					leadingIcon: ARTIST_ICON,
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
							? REMOVE_CACHE_ICON
							: DOWNLOAD_ICON,
					onPress: async () => {
						if (downloadState === DownloadState.COMPLETED) {
							await Orpheus.removeDownload(item.uniqueKey)
							toast.success('删除缓存成功')
							await queryClient.invalidateQueries({
								queryKey: ['batchDownloadStatus'],
							})
							return
						}

						try {
							const url = getInternalPlayUri(item)
							if (!url) {
								toastAndLogError('获取内部播放地址失败', '失败了！', SCOPE)
								return
							}
							let artistName: string | undefined
							if (item.artist) {
								artistName = item.artist.name
							}
							let artwork: string | undefined
							if (item.coverUrl) {
								artwork = item.coverUrl
							}

							await Orpheus.downloadTrack({
								id: item.uniqueKey,
								url: url,
								title: item.title,
								artist: artistName,
								artwork: artwork,
								duration: item.duration,
							})

							toast.success('已开始下载')
						} catch (error) {
							toastAndLogError('缓存音频失败', error, SCOPE)
						}
					},
					isHighFreq: true,
				},
			)
		}
		menuItems.push(
			{
				title: '复制封面链接',
				leadingIcon: LINK_ICON,
				onPress: () => {
					void Clipboard.setStringAsync(item.coverUrl ?? '')
					toast.success('已复制到剪贴板')
				},
			},
			{
				title: '编辑信息',
				leadingIcon: EDIT_ICON,
				onPress: () => openEditTrackModal(item),
			},
		)
		if (playlist?.type === 'local' && !isReadOnly) {
			menuItems.push({
				title: '删除歌曲',
				leadingIcon: DELETE_ICON,
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
