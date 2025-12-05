import { MULTIPAGE_VIDEO_KEYWORDS } from '@/features/playlist/remote/search-result/constants'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { BilibiliTrack } from '@/types/core/media'
import { addToQueue } from '@/utils/player'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'

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
			await addToQueue({
				tracks: [track],
				playNow: !playNext,
				clearQueue: false,
				playNext: playNext,
				startFromKey: track.uniqueKey,
			})
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
