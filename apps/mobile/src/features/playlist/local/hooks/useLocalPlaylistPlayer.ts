import { useCallback } from 'react'
import type { MMKV } from 'react-native-mmkv'
import { useMMKVBoolean } from 'react-native-mmkv'

import { alert } from '@/components/modals/AlertModal'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import { playlistService } from '@/lib/services/playlistService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { storage } from '@/utils/mmkv'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

const SCOPE = 'UI.Playlist.Local.Player'

export function useLocalPlaylistPlayer(
	playlistId: number,
	isOffline?: boolean,
	playableOfflineKeys?: Set<string>,
) {
	const currentTrackId = useCurrentTrackId()
	const [ignoreAlertReplacePlaylist, setIgnoreAlertReplacePlaylist] =
		useMMKVBoolean('ignore_alert_replace_playlist', storage as MMKV)

	const playAll = useCallback(
		async (startFromId?: string) => {
			const tracksResult = await playlistService.getPlaylistTracks(playlistId)
			if (tracksResult.isErr()) {
				toastAndLogError('获取播放列表内容失败', tracksResult.error, SCOPE)
				return
			}
			let tracks = tracksResult.value.filter((item) =>
				item.source === 'bilibili' ? item.bilibiliMetadata.videoIsValid : true,
			)

			if (isOffline && playableOfflineKeys) {
				const originalLength = tracks.length
				tracks = tracks.filter((t) => playableOfflineKeys.has(t.uniqueKey))
				if (tracks.length === 0) {
					toast.show('当前离线，没有可播放的已缓存歌曲')
					return
				}
				if (tracks.length < originalLength) {
					toast.show('当前离线，仅添加可播放的已缓存歌曲到播放队列')
				}
			}

			if (!tracks || tracks.length === 0) {
				return
			}

			try {
				await addToQueue({
					tracks: tracks,
					playNow: true,
					clearQueue: true,
					startFromKey: startFromId,
					playNext: false,
				})
			} catch (error) {
				toastAndLogError('播放全部失败', error, SCOPE)
			}
		},
		[playlistId, isOffline, playableOfflineKeys],
	)

	const handleTrackPress = useCallback(
		(track: Track) => {
			if (
				isOffline &&
				playableOfflineKeys &&
				!playableOfflineKeys.has(track.uniqueKey)
			) {
				toast.show('当前无网络，无法播放，请检查网络设置')
				return
			}
			if (track.uniqueKey === currentTrackId) return
			if (!ignoreAlertReplacePlaylist) {
				alert(
					'替换播放列表',
					'点击列表中的单曲会直接替换当前播放列表，是否继续？（下次不再提醒）',
					[
						{ text: '取消' },
						{
							text: '确定',
							onPress: () => {
								setIgnoreAlertReplacePlaylist(true)
								void playAll(track.uniqueKey)
							},
						},
					],
					{ cancelable: true },
				)
				return
			}
			void playAll(track.uniqueKey)
		},
		[
			currentTrackId,
			ignoreAlertReplacePlaylist,
			playAll,
			setIgnoreAlertReplacePlaylist,
			isOffline,
			playableOfflineKeys,
		],
	)

	return { playAll, handleTrackPress }
}
