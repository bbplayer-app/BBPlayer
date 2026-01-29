import { useRouter } from 'expo-router'
import { useCallback } from 'react'

import { MULTIPAGE_VIDEO_KEYWORDS } from '@/features/playlist/remote/search-result/constants'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { syncFacade } from '@/lib/facades/sync'
import type { BilibiliTrack } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

export function useSearchInteractions() {
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)

	const playTrack = useCallback(
		async (track: BilibiliTrack, playNext = false) => {
			if (
				MULTIPAGE_VIDEO_KEYWORDS.some((keyword) =>
					track.title?.includes(keyword),
				)
			) {
				router.push({
					pathname: '/playlist/remote/multipage/[bvid]',
					params: { bvid: track.bilibiliMetadata.bvid },
				})
				return
			}
			const createIt = await syncFacade.addTrackToLocal(track)
			if (createIt.isErr()) {
				toastAndLogError(
					'将 track 录入本地失败',
					createIt.error,
					'UI.Playlist.Remote',
				)
				reportErrorToSentry(
					createIt.error,
					'将 track 录入本地失败',
					'UI.Playlist.Remote',
				)
				return
			}
			await addToQueue({
				tracks: [track],
				playNow: !playNext,
				clearQueue: false,
				playNext: playNext,
				startFromKey: track.uniqueKey,
			})
			if (playNext) {
				toast.success('添加到下一首播放成功')
			}
		},
		[router],
	)

	const trackMenuItems = useCallback(
		(item: BilibiliTrack) => [
			{
				title: '下一首播放',
				leadingIcon: 'skip-next-circle-outline',
				onPress: () => playTrack(item, true),
			},
			{
				title: '查看详细信息',
				leadingIcon: 'file-document-outline',
				onPress: () => {
					router.push({
						pathname: '/playlist/remote/multipage/[bvid]',
						params: { bvid: item.bilibiliMetadata.bvid },
					})
				},
			},
			{
				title: '添加到本地歌单',
				leadingIcon: 'playlist-plus',
				onPress: () => {
					openModal('UpdateTrackLocalPlaylists', { track: item })
				},
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
		],
		[router, openModal, playTrack],
	)

	return {
		playTrack,
		trackMenuItems,
	}
}
