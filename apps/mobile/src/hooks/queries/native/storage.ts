import { getStorageUsageAsync } from '@bbplayer/native'
import { useQuery } from '@tanstack/react-query'

import { queryClient } from '@/lib/config/queryClient'

export const storageQueryKeys = {
	all: ['appStorage'] as const,
	usage: () => [...storageQueryKeys.all, 'usage'] as const,
}

queryClient.setQueryDefaults(storageQueryKeys.all, {
	networkMode: 'always',
	gcTime: 0,
	staleTime: 0,
	retry: false,
})

/**
 * 读取应用私有目录与安装包的存储占用。
 *
 * 原生统计会遍历磁盘，开销较大。调用方应通过 `enabled` 在屏幕过渡动画结束后再触发，
 * 避免拖慢转场。
 */
export function useStorageUsage(enabled = true) {
	return useQuery({
		queryKey: storageQueryKeys.usage(),
		queryFn: () => getStorageUsageAsync(),
		enabled,
		meta: { silent: true },
	})
}
