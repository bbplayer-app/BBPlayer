import { Orpheus } from '@bbplayer/orpheus'
import { useMutation } from '@tanstack/react-query'

import { orpheusQueryKeys } from '@/hooks/queries/orpheus'
import { queryClient } from '@/lib/config/queryClient'

queryClient.setMutationDefaults(['orpheus'], {
	retry: false,
	networkMode: 'always',
})

export function useRemoveDownloadsMutation() {
	return useMutation({
		mutationFn: async (ids: string[]) => {
			await Orpheus.removeDownloads(ids)
		},
		mutationKey: ['orpheus', 'removeDownloads'],
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpheusQueryKeys.allDownloads(),
			})
		},
	})
}
