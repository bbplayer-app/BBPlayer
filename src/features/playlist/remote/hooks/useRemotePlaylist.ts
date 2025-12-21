import { syncFacade } from '@/lib/facades/sync'
import type { BilibiliTrack } from '@/types/core/media'
import { effectToPromise } from '@/utils/effect'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'
import { useCallback } from 'react'

export function useRemotePlaylist() {
	const playTrack = useCallback(
		async (track: BilibiliTrack, playNext = false) => {
			try {
				await effectToPromise(syncFacade.addTrackToLocal(track))
			} catch (error) {
				toastAndLogError('将 track 录入本地失败', error, 'UI.Playlist.Remote')
				reportErrorToSentry(
					error,
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

	return { playTrack }
}
