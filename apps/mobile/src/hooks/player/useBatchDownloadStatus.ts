import { Orpheus } from '@bbplayer/orpheus'
import { useQuery } from '@tanstack/react-query'

export function useBatchDownloadStatus(ids: string[]) {
	return useQuery({
		queryKey: ['batchDownloadStatus', ids],
		queryFn: async () => {
			return await Orpheus.getDownloadStatusByIds(ids)
		},
		staleTime: 0,
		gcTime: 0,
		enabled: ids.length > 0,
	})
}
