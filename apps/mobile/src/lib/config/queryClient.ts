import * as Sentry from '@sentry/react-native'
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'

import { type WebDavBackupConfig } from '@/hooks/queries/backup'
import { WebDavError } from '@/lib/backup/webdav-client'
import { ThirdPartyError } from '@/lib/errors'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

/**
 * 用于检查任意变量是否属于 WebDavBackupConfig 类型，用于在上报错误时遮蔽掉敏感信息
 * @param value
 */
function isWebDavBackupConfig(value: unknown): value is WebDavBackupConfig {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false
	}

	const obj = value as Record<string, unknown>

	return (
		typeof obj.baseUrl === 'string' &&
		typeof obj.username === 'string' &&
		typeof obj.directory === 'string'
	)
}

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
						router.navigate('/settings/bilibili-account/qrcode-login')
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

			let queryKey = query.queryKey

			// 这个错误属于三方依赖的错误，不应该报告到 Sentry
			if (error instanceof ThirdPartyError) {
				return
			}

			// 我们只上报 unknown 类型的 WebDav 报错，同时屏蔽掉敏感信息
			if (error instanceof WebDavError) {
				if (error.kind !== 'unknown') {
					return
				}
				const redactedQueryKey = [...queryKey]
				const configObject = queryKey.at(-1)
				if (isWebDavBackupConfig(configObject)) {
					redactedQueryKey[redactedQueryKey.length - 1] = {
						...configObject,
						baseUrl: '[redacted]',
						username: '[redacted]',
						directory: '[redacted]',
					}
				}
				queryKey = redactedQueryKey
			}

			Sentry.captureException(error, {
				tags: {
					scope: 'QueryCache',
					queryKey: JSON.stringify(queryKey),
				},
				extra: {
					retry: query.options.retry,
				},
			})
		},
	}),
})
