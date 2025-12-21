import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import type { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import {
	BilibiliRequestFailedError,
	BilibiliResponseFailedError,
} from '@/lib/errors/thirdparty/bilibili'
import { Effect } from 'effect'
import { getCsrfToken } from './utils'

export interface ReqResponse<T> {
	code: number
	message: string
	data: T
}

class ApiClient {
	private baseUrl = 'https://api.bilibili.com'

	/**
	 * 核心请求方法，使用 Effect 进行封装
	 * @param endpoint API 端点
	 * @param options Fetch 请求选项
	 * @returns Effect 包含成功数据或错误
	 */
	private request = <T>(
		endpoint: string,
		options: RequestInit = {},
		fullUrl?: string,
	): Effect.Effect<T, BilibiliApiError> => {
		const url = fullUrl ?? `${this.baseUrl}${endpoint}`
		const cookieList = useAppStore.getState().bilibiliCookie
		const cookie = cookieList ? serializeCookieObject(cookieList) : ''

		const headers = {
			Cookie: cookie,
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0',
			...options.headers,
		}

		return Effect.tryPromise({
			try: () =>
				fetch(url, {
					...options,
					headers,
					// react native 实现了 cookie 的自动注入，但我们正在自己管理 cookie，所以忽略
					// TODO: 应该采用 react-native-cookie 库实现与原生请求库 cookie jar 的更紧密集成。但现阶段我们直接忽略原生注入的 cookie。
					credentials: 'omit',
				}),
			catch: (error) =>
				new BilibiliRequestFailedError({
					message: `请求失败: ${error instanceof Error ? error.message : String(error)}`,
					cause: error,
				}),
		}).pipe(
			Effect.flatMap(
				(response): Effect.Effect<ReqResponse<T>, BilibiliApiError> => {
					if (!response.ok) {
						return Effect.fail(
							new BilibiliRequestFailedError({
								message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
								msgCode: response.status,
							}),
						)
					}
					return Effect.tryPromise({
						try: () => response.json() as Promise<ReqResponse<T>>,
						catch: (error) =>
							new BilibiliRequestFailedError({
								message: error instanceof Error ? error.message : String(error),
							}),
					})
				},
			),
			Effect.flatMap((data) => {
				// 对于 wbi 接口，直接返回 data，因为未登录状态下 code 为 -101
				if (endpoint === '/x/web-interface/nav') {
					return Effect.succeed(data.data)
				}
				if (data.code !== 0) {
					return Effect.fail(
						new BilibiliResponseFailedError({
							message: data.message,
							msgCode: data.code,
							rawData: data.data,
						}),
					)
				}
				return Effect.succeed(data.data)
			}),
		)
	}

	/**
	 * 发送 GET 请求
	 * @param endpoint API 端点
	 * @param params URL 查询参数
	 * @param fullUrl 完整的 URL，如果提供则忽略 baseUrl
	 * @returns Effect 包含成功数据或错误
	 */
	get<T>(
		endpoint: string,
		params?: Record<string, string | undefined> | string,
		fullUrl?: string,
	): Effect.Effect<T, BilibiliApiError> {
		let url = endpoint
		if (typeof params === 'string') {
			url = `${endpoint}?${params}`
		} else if (params) {
			const searchParams = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, value)
				}
			}
			url = `${endpoint}?${searchParams.toString()}`
		}
		return this.request<T>(url, { method: 'GET' }, fullUrl)
	}

	/**
	 * 发送 POST 请求
	 * @param endpoint API 端点
	 * @param data 请求体数据
	 * @param headers 请求头（默认请求类型为 application/x-www-form-urlencoded）
	 * @param fullUrl 完整的 URL，如果提供则忽略 baseUrl
	 * @returns Effect 包含成功数据或错误
	 */
	post<T>(
		endpoint: string,
		data?: BodyInit,
		headers?: Record<string, string>,
		fullUrl?: string,
	): Effect.Effect<T, BilibiliApiError> {
		return this.request<T>(
			endpoint,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...headers,
				},
				body: data,
			},
			fullUrl,
		)
	}

	/**
	 * 自动处理 CSRF token 并发送 POST 请求 (x-www-form-urlencoded)
	 * @param url 请求的 URL
	 * @param payload 请求体数据
	 * @returns
	 */
	public postWithCsrf<T>(
		url: string,
		payload: Record<string, string> = {},
	): Effect.Effect<T, BilibiliApiError> {
		return getCsrfToken().pipe(
			Effect.flatMap((csrfToken) => {
				const dataWithCsrf = {
					...payload,
					csrf: csrfToken,
				}

				const body = new URLSearchParams(dataWithCsrf).toString()

				return this.post<T>(url, body)
			}),
		)
	}
}
export const bilibiliApiClient = new ApiClient()
