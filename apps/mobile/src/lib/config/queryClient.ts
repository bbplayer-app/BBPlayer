import * as Sentry from '@sentry/react-native'
import { QueryCache, QueryClient } from '@tanstack/react-query'

import { useModalStore } from '@/hooks/stores/useModalStore'
import { ThirdPartyError } from '@/lib/errors'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 2,
			refetchOnWindowFocus: true,
			refetchOnMount: true,
			refetchOnReconnect: true,
			refetchInterval: false,
		},
	},
	queryCache: new QueryCache({
		onError: (error, query) => {
			const handleOfflineError = async () => {
				try {
					if (
						error instanceof BilibiliApiError &&
						error.data.msgCode === -101
					) {
						toast.error('登录状态失效，请重新登录')
						useModalStore.getState().open('QRCodeLogin', undefined)
						return
					}

					toastAndLogError(
						'查询失败: ' + query.queryKey.toString(),
						error,
						'Query',
					)
				} catch {
					// Fallback in case Network check throws
					toastAndLogError(
						'查询失败: ' + query.queryKey.toString(),
						error,
						'Query',
					)
				}
			}

			void handleOfflineError()

			// 这个错误属于三方依赖的错误，不应该报告到 Sentry
			if (error instanceof ThirdPartyError) {
				return
			}

			Sentry.captureException(error, {
				tags: {
					scope: 'QueryCache',
					queryKey: JSON.stringify(query.queryKey),
				},
				extra: {
					queryHash: query.queryHash,
					retry: query.options.retry,
				},
			})
		},
	}),
})
