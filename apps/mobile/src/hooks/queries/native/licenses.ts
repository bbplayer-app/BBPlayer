import { ReactNativeLegal } from 'react-native-legal'

import { useTracedQuery } from '@/hooks/utils/useTracedQuery'

export const licensesQueryKeys = {
	all: ['openSourceLicenses'] as const,
}

/**
 * 读取构建时生成的开源组件列表：react-native-legal 在 prebuild 时扫描 JS 依赖，
 * AboutLibraries 在 Gradle 构建时收集原生依赖，两者合并成同一份数据。内容随安装包固定，不会过期。
 */
export function useOpenSourceLibraries() {
	return useTracedQuery({
		span: { name: 'app.licenses' },
		queryKey: licensesQueryKeys.all,
		queryFn: async () => (await ReactNativeLegal.getLibrariesAsync()).data,
		staleTime: Infinity,
		networkMode: 'always',
		meta: { silent: true },
	})
}
