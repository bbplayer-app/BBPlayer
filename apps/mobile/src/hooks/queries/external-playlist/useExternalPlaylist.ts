import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import { externalPlaylistService } from '@/lib/services/externalPlaylistService'

export const useExternalPlaylist = (
	playlistId: string,
	source: 'netease' | 'qq',
) => {
	return useTracedQuery({
		span: { name: 'external_playlist.get' },
		queryKey: ['external-playlist', source, playlistId],
		queryFn: async () => {
			if (!playlistId) return null

			const result = await externalPlaylistService.fetchExternalPlaylist(
				playlistId,
				source,
			)

			if (result.isErr()) {
				throw result.error
			}

			return result.value
		},
		enabled: !!playlistId,
	})
}
