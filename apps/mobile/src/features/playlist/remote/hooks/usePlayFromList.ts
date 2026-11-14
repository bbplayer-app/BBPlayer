import { useCallback } from 'react'
import type { MMKV } from 'react-native-mmkv'
import { useMMKVBoolean } from 'react-native-mmkv'

import { alert } from '@/components/modals/AlertModal'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import type { BilibiliTrack } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { storage } from '@/utils/mmkv'
import { addToQueue } from '@/utils/player'

const SCOPE = 'UI.Playlist.Remote'

/**
 * 点击在线列表中的单曲时，把列表里已经加载出来的曲目从这首开始一起放进播放队列（替换当前队列），
 * 行为与本地歌单一致。
 *
 * 只使用页面上已经加载的数据，不会为了凑齐整个列表去额外请求后续分页。
 */
export function usePlayFromList() {
	// SAFETY: storage 就是 createMMKV() 创建的 MMKV 实例（见 utils/mmkv-instance.ts），只是类型被标注为 TypedMMKVInterface
	const [ignoreAlertReplacePlaylist, setIgnoreAlertReplacePlaylist] =
		useMMKVBoolean('ignore_alert_replace_playlist', storage as MMKV)

	const play = useCallback(
		async (track: BilibiliTrack, tracks: BilibiliTrack[]) => {
			const queue = tracks.some((item) => item.uniqueKey === track.uniqueKey)
				? tracks.filter(
						(item) =>
							item.uniqueKey === track.uniqueKey ||
							item.bilibiliMetadata.videoIsValid,
					)
				: [track]

			const createIt = await syncFacade.addTracksToLocal(queue)

			if (createIt.isErr()) {
				toastAndLogError('将 track 录入本地失败', createIt.error, SCOPE)
				reportErrorToSentry(createIt.error, '将 track 录入本地失败', SCOPE)

				return
			}

			await addToQueue({
				tracks: queue,
				playNow: true,
				clearQueue: true,
				playNext: false,
				startFromKey: track.uniqueKey,
			})
		},
		[],
	)

	return useCallback(
		(track: BilibiliTrack, tracks: BilibiliTrack[]) => {
			if (ignoreAlertReplacePlaylist) {
				void play(track, tracks)

				return
			}

			alert(
				'替换播放列表',
				'点击列表中的单曲会直接替换当前播放列表，是否继续？（下次不再提醒）',
				[
					{ text: '取消' },
					{
						text: '确定',
						onPress: () => {
							setIgnoreAlertReplacePlaylist(true)
							void play(track, tracks)
						},
					},
				],
				{ cancelable: true },
			)
		},
		[ignoreAlertReplacePlaylist, play, setIgnoreAlertReplacePlaylist],
	)
}
