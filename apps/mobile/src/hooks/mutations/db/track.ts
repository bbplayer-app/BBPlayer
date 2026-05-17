import { useMutation } from '@tanstack/react-query'

import { playlistKeys } from '@/hooks/queries/db/playlist'
import { trackKeys } from '@/hooks/queries/db/track'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { queryClient } from '@/lib/config/queryClient'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'

queryClient.setMutationDefaults(['db', 'track'], {
	retry: false,
	networkMode: 'always',
})

export const useEditTrackMetadata = () => {
	return useMutation({
		mutationKey: ['db', 'track', 'editMetadata'],
		mutationFn: async ({
			trackId,
			title,
			coverUrl,
			source,
		}: {
			trackId: number
			title: string
			coverUrl?: string | null
			source: Track['source']
		}) => {
			const result = await trackService.updateTrack({
				id: trackId,
				title,
				coverUrl,
				source,
			})
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (track) => {
			if (usePlayerStore.getState().internalTrack?.id === track.id) {
				usePlayerStore.setState({ internalTrack: track })
			}
			await queryClient.invalidateQueries({
				queryKey: [...playlistKeys.all, 'playlistContents'],
			})
			await queryClient.invalidateQueries({
				queryKey: trackKeys.all,
			})
		},
		onError: () => {},
	})
}

export const useRenameTrack = () => useEditTrackMetadata()
