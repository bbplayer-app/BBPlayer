import { playlistKeys } from '@/hooks/queries/db/playlist'
import { trackKeys } from '@/hooks/queries/db/track'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { useTracedMutation } from '@/hooks/utils/useTracedQuery'
import { queryClient } from '@/lib/config/queryClient'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'

queryClient.setMutationDefaults(['db', 'track'], {
	retry: false,
	networkMode: 'always',
})

export const useEditTrackMetadata = () => {
	return useTracedMutation({
		span: { name: 'track.edit_metadata' },
		mutationKey: ['db', 'track', 'editMetadata'],
		mutationFn: async (
			{
				trackId,
				title,
				coverUrl,
				source,
			}: {
				trackId: number
				title: string
				coverUrl?: string | null
				source: Track['source']
			},
			{ span },
		) => {
			const result = await trackService.withTrace(span).updateTrack({
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
