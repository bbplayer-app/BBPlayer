import { useCallback } from 'react'

import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import type { BilibiliTrack } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import { addToQueue } from '@/utils/player'

export function useRemotePlaylist() {
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

	return { playTrack }
}
