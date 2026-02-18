import { type Type, type } from 'arktype'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'

import { getCsrfToken } from './utils'

export interface ReqResponse<T> {
	code: number
	message: string
	data: T
}

interface BaseApiOptions<T = unknown> {
	/**
	 * 请求目标 URL，可以是相对路径（如 `/x/web-interface/nav`）或完整 URL（如 `https://api.bilibili.com/...`）
	 * 如果是相对路径，将会自动拼接 base URL (`https://api.bilibili.com`)
	 * 如果是完整 URL，将会直接使用
	 */
	target: string
	/**
	 * 自定义请求头
	 */
	headers?: Record<string, string>
	/**
	 * ArkType 验证器，用于验证响应数据结构
	 */
	validator?: Type<T>
	/**
	 * 是否跳过 Cookie 注入，默认为 false
	 */
	skipCookie?: boolean
	/**
	 * 是否跳过业务状态码检查 (code !== 0)，默认为 false
	 * 对于某些特殊接口（如未由标准业务层封装的接口），可能需要跳过
	 */
	skipCodeCheck?: boolean
	/**
	 * 原生 fetch 选项，透传给 fetch 函数
	 */
	fetchOptions?: Omit<RequestInit, 'body' | 'headers' | 'method'>
}

export interface ApiGetOptions<T = unknown> extends BaseApiOptions<T> {
	/**
	 * URL 查询参数
	 * - 对象形式: `{ key: value }`，会自动序列化为 query string
	 * - 字符串形式: `key=value`，直接拼接到 URL 后
	 */
	params?: Record<string, string | number | undefined> | string
}

export interface ApiPostOptions<T = unknown> extends BaseApiOptions<T> {
	/**
	 * URL 查询参数
	 */
	params?: Record<string, string | number | undefined> | string
	/**
	 * 请求体数据
	 */
	data?: BodyInit
}

export type ApiRequestOptions<T = unknown> = ApiGetOptions<T> &
	ApiPostOptions<T>

class ApiClient {
	private baseUrl = 'https://api.bilibili.com'

	private buildUrl(
		target: string,
		params?: Record<string, string | number | undefined> | string,
	): string {
		let url = target
		if (typeof params === 'string') {
			url = `${target}?${params}`
		} else if (params) {
			const searchParams = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					searchParams.append(key, String(value))
				}
			}
			url = `${target}?${searchParams.toString()}`
		}

		if (url.startsWith('http://') || url.startsWith('https://')) {
			return url
		}

		return `${this.baseUrl}${url}`
	}

	private buildHeaders(
		skipCookie: boolean = false,
		customHeaders?: Record<string, string>,
	): Headers {
		const cookieList = useAppStore.getState().bilibiliCookie
		const cookie =
			cookieList && !skipCookie ? serializeCookieObject(cookieList) : ''

		const defaultHeaders = {
			Cookie: cookie,
			'User-Agent':
				'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0',
			Referer: 'https://www.bilibili.com/',
			Origin: 'https://www.bilibili.com',
		}

		const headers = new Headers(defaultHeaders)

		if (customHeaders) {
			Object.entries(customHeaders).forEach(([key, value]) => {
				headers.set(key, value)
			})
		}
		return headers
	}

	/**
	 * 核心请求方法，使用 neverthrow 进行封装
	 */
	private request = <T>(
		options: ApiRequestOptions<T> & { method: string },
	): ResultAsync<T, BilibiliApiError> => {
		const {
			target,
			method,
			validator,
			skipCookie,
			skipCodeCheck,
			data: bodyData,
			fetchOptions,
			headers: customHeaders,
		} = options

		// 显式忽略 params，request 方法不处理 query params 的组装，应由 get/post 方法处理好 target
		const url = target.startsWith('http') ? target : `${this.baseUrl}${target}`
		const headers = this.buildHeaders(skipCookie, customHeaders)

		return ResultAsync.fromPromise(
			fetch(url, {
				...fetchOptions,
				method,
				headers,
				body: bodyData,
				// react native 实现了 cookie 的自动注入，但我们正在自己管理 cookie，所以忽略
				// TODO: 应该采用 react-native-cookie 库实现与原生请求库 cookie jar 的更紧密集成。但现阶段我们直接忽略原生注入的 cookie。
				credentials: 'omit',
			}),
			(error) =>
				new BilibiliApiError({
					message: `请求失败: ${error instanceof Error ? error.message : String(error)}`,
					type: 'RequestFailed',
					cause: error,
				}),
		)
			.andThen((response) => {
				if (!response.ok) {
					return errAsync(
						new BilibiliApiError({
							message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
							msgCode: response.status,
							type: 'RequestFailed',
						}),
					)
				}
				return ResultAsync.fromPromise(
					response.json() as Promise<ReqResponse<T>>,
					(error) =>
						new BilibiliApiError({
							message: error instanceof Error ? error.message : String(error),
							type: 'ResponseFailed',
						}),
				)
			})
			.andThen((data) => {
				if (skipCodeCheck) {
					return okAsync(data.data)
				}
				if (data.code !== 0) {
					return errAsync(
						new BilibiliApiError({
							message: data.message,
							msgCode: data.code,
							rawData: data.data,
							type: 'ResponseFailed',
						}),
					)
				}

				if (validator) {
					const result = validator(data.data)
					if (result instanceof type.errors) {
						return errAsync(
							new BilibiliApiError({
								message: `数据校验失败: ${result.summary}`,
								type: 'ValidationFailed',
								rawData: data.data,
								cause: result,
							}),
						)
					}
					return okAsync(result as T)
				}

				return okAsync(data.data)
			})
	}

	/**
	 * 发送 GET 请求
	 */
	get<T>(options: ApiGetOptions<T>): ResultAsync<T, BilibiliApiError> {
		const { target, params } = options
		const url = this.buildUrl(target, params)

		return this.request<T>({
			...options,
			target: url,
			method: 'GET',
		})
	}

	/**
	 * 发送 GET 请求并返回 ArrayBuffer
	 */
	getBuffer(
		options: Omit<ApiGetOptions, 'validator'>,
	): ResultAsync<ArrayBuffer, BilibiliApiError> {
		const { target, params, skipCookie, headers: customHeaders } = options

		const requestUrl = this.buildUrl(target, params)
		const requestHeaders = this.buildHeaders(skipCookie, customHeaders)

		return ResultAsync.fromPromise(
			fetch(requestUrl, {
				method: 'GET',
				headers: requestHeaders,
				credentials: 'omit',
			}),
			(error) =>
				new BilibiliApiError({
					message: `请求失败: ${error instanceof Error ? error.message : String(error)}`,
					type: 'RequestFailed',
					cause: error,
				}),
		).andThen((response) => {
			if (!response.ok) {
				return errAsync(
					new BilibiliApiError({
						message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
						msgCode: response.status,
						type: 'RequestFailed',
					}),
				)
			}
			return ResultAsync.fromPromise(
				response.arrayBuffer(),
				(error) =>
					new BilibiliApiError({
						message: error instanceof Error ? error.message : String(error),
						type: 'ResponseFailed',
					}),
			)
		})
	}

	/**
	 * 发送 POST 请求
	 */
	post<T>(options: ApiPostOptions<T>): ResultAsync<T, BilibiliApiError> {
		const { headers } = options
		return this.request<T>({
			...options,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				...headers,
			},
		})
	}

	/**
	 * 自动处理 CSRF token 并发送 POST 请求 (x-www-form-urlencoded)
	 */
	public postWithCsrf<T>(
		options: Omit<ApiPostOptions<T>, 'data'> & {
			payload?: Record<string, string>
		},
	): ResultAsync<T, BilibiliApiError> {
		const { payload = {}, ...rest } = options
		return getCsrfToken().asyncAndThen((csrfToken) => {
			const dataWithCsrf = {
				...payload,
				csrf: csrfToken,
			}
			const body = new URLSearchParams(dataWithCsrf).toString()

			return this.post<T>({
				...rest,
				data: body,
			})
		})
	}
}
export const bilibiliApiClient = new ApiClient()
