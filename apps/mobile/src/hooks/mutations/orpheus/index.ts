import { Orpheus } from '@bbplayer/orpheus'

import { orpheusQueryKeys } from '@/hooks/queries/orpheus'
import { useTracedMutation } from '@/hooks/utils/useTracedQuery'
import { queryClient } from '@/lib/config/queryClient'

queryClient.setMutationDefaults(['orpheus'], {
	retry: false,
	networkMode: 'always',
})

export function useRemoveDownloadsMutation() {
	return useTracedMutation({
		span: { name: 'download.remove' },
		mutationFn: async (ids: string[]) => {
			await Orpheus.removeDownloads(ids)
		},
		mutationKey: ['orpheus', 'removeDownloads'],
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpheusQueryKeys.completedDownloads(),
			})
		},
	})
}
