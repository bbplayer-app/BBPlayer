import { useCallback } from 'react'

import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import type { BilibiliTrack } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'

import { usePlayFromList } from './usePlayFromList'

/**
 * @param tracks 列表中当前已加载的曲目，点击单曲时会从这首开始一起加入播放队列
 */
export function useRemotePlaylist(tracks?: BilibiliTrack[]) {
	const playFromListBase = usePlayFromList()

	const playTrack = useCallback(
		async (track: BilibiliTrack, playNext = false) => {
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

			void addToQueue({
				tracks: [track],
				playNow: !playNext,
				clearQueue: false,
				playNext: playNext,
				startFromKey: track.uniqueKey,
			})
		},
		[],
	)

	const playFromList = useCallback(
		(track: BilibiliTrack) => playFromListBase(track, tracks ?? [track]),
		[playFromListBase, tracks],
	)

	return { playTrack, playFromList }
}
