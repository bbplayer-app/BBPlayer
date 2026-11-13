import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { fetch } from 'react-native-nitro-fetch'

import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { BilibiliApiError } from '@/lib/errors/thirdparty/bilibili'
import { type TraceParent, traceResult } from '@/lib/tracing'

import { getCsrfToken } from './utils'

export const BILIBILI_WEB_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36'

/**
 * API 请求默认携带的浏览器请求头，与桌面端网页保持一致
 * 注意：passport 登录相关接口仍需使用 App UA，见 api.ts 中 PASSPORT_UA
 */
export const BILIBILI_DEFAULT_HEADERS = {
	'User-Agent': BILIBILI_WEB_USER_AGENT,
	Accept: 'application/json, text/plain, */*',
	'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
	Referer: 'https://www.bilibili.com/',
	Origin: 'https://www.bilibili.com',
} as const

export interface ReqResponse<T> {
	code: number
	message: string
	data: T
}

const toRequestError = (error: unknown) => {
	if (error instanceof Error && error.name === 'AbortError') {
		return new BilibiliApiError({
			message: '请求被取消',
			type: 'RequestAborted',
			cause: error,
		})
	}

	return new BilibiliApiError({
		message: `请求失败: ${error instanceof Error ? error.message : String(error)}`,
		type: 'RequestFailed',
		cause: error,
	})
}

// span 只记录路径，不记录 query：wbi 签名、csrf 等参数不应进入遥测
const toUrlPath = (url: string) => {
	const queryStart = url.indexOf('?')

	return queryStart === -1 ? url : url.slice(0, queryStart)
}

export class ApiClient {
	private baseUrl = 'https://api.bilibili.com'

	constructor(private readonly traceParent?: TraceParent) {}

	/**
	 * 返回一个把请求 span 挂到指定 parent 下的新实例。
	 * @param parent - 当前业务流程的 span，为空时不产生 span。
	 */
	withTrace(parent: TraceParent) {
		return new ApiClient(parent)
	}

	/**
	 * 核心请求 method，使用 neverthrow 进行封装
	 */
	private request = <T>({
		endpoint,
		options = {},
		fullUrl,
		skipCookie,
	}: {
		endpoint: string
		options?: RequestInit
		fullUrl?: string
		skipCookie?: boolean
	}): ResultAsync<T, BilibiliApiError> => {
		const url = fullUrl ?? `${this.baseUrl}${endpoint}`
		const cookieList = useAppStore.getState().bilibiliCookie

		const cookie =
			cookieList && !skipCookie ? serializeCookieObject(cookieList) : ''

		const defaultHeaders = {
			...BILIBILI_DEFAULT_HEADERS,
			Cookie: cookie,
		}

		const headers = new Headers(defaultHeaders)

		if (options.headers) {
			new Headers(options.headers).forEach((value, key) => {
				headers.set(key, value)
			})
		}

		const method = options.method ?? 'GET'
		const path = toUrlPath(url)

		return traceResult(
			this.traceParent,
			{
				name: `${method} ${path}`,
				op: 'http.client',
				attributes: {
					'http.request.method': method,
					'url.full': path,
				},
			},
			(span) =>
				ResultAsync.fromPromise(
					fetch(url, {
						...options,
						headers,
						// react native 实现了 cookie 的自动注入，但我们正在自己管理 cookie，所以忽略
						// TODO: 应该采用 react-native-cookie 库实现与原生请求库 cookie jar 的更紧密集成。但现阶段我们直接忽略原生注入的 cookie。
						credentials: 'omit',
					}),
					toRequestError,
				)
					.andTee((response) => {
						span?.setAttribute('http.response.status_code', response.status)
					})
					.andThen((response) => this.parseResponse<T>(response))
					.andTee((data) => {
						span?.setAttribute('bilibili.code', data.code)
					})
					.andThen((data) => this.unwrapResponse<T>(endpoint, data)),
		)
	}

	private parseResponse<T>(
		response: Response,
	): ResultAsync<ReqResponse<T>, BilibiliApiError> {
		if (!response.ok) {
			return errAsync(
				new BilibiliApiError({
					message: `请求 bilibili API 失败: ${response.status} ${response.statusText}`,
					msgCode: response.status,
					type: 'RequestFailed',
				}),
			)
		}

		const data = response.json() as Promise<ReqResponse<T>>

		return ResultAsync.fromPromise(
			data,
			(error) =>
				new BilibiliApiError({
					message: error instanceof Error ? error.message : String(error),
					type: 'ResponseFailed',
				}),
		)
	}

	private unwrapResponse<T>(
		endpoint: string,
		data: ReqResponse<T>,
	): ResultAsync<T, BilibiliApiError> {
		// 对于 wbi 接口，直接返回 data，因为未登录状态下 code 为 -101
		if (endpoint === '/x/web-interface/nav') {
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

		return okAsync(data.data)
	}

	/**
	 * 发送 GET 请求
	 * @returns ResultAsync 包含成功数据或错误
	 */
	get<T>({
		endpoint,
		params,
		headers,
		fullUrl,
		skipCookie,
		signal,
	}: {
		endpoint: string
		params?: Record<string, string | undefined> | string
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<T, BilibiliApiError> {
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

		return this.request<T>({
			endpoint: url,
			options: { method: 'GET', signal, headers },
			fullUrl,
			skipCookie,
		})
	}

	/**
	 * 发送 GET 请求并返回 ArrayBuffer
	 * @returns ResultAsync 包含 ArrayBuffer 或错误
	 */
	getBuffer({
		endpoint,
		params,
		headers,
		fullUrl,
		skipCookie,
		signal,
	}: {
		endpoint: string
		params?: Record<string, string | undefined> | string
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
		signal?: AbortSignal
	}): ResultAsync<ArrayBuffer, BilibiliApiError> {
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

		const requestUrl = fullUrl ?? `${this.baseUrl}${url}`
		const cookieList = useAppStore.getState().bilibiliCookie

		const cookie =
			cookieList && !skipCookie ? serializeCookieObject(cookieList) : ''

		const requestHeaders = {
			...BILIBILI_DEFAULT_HEADERS,
			Cookie: cookie,
			...headers,
		}

		return ResultAsync.fromPromise(
			fetch(requestUrl, {
				method: 'GET',
				headers: requestHeaders,
				signal,
				credentials: 'omit',
			}),
			toRequestError,
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
	 * @returns ResultAsync 包含成功数据或错误
	 */
	post<T>({
		endpoint,
		data,
		headers,
		fullUrl,
		skipCookie,
	}: {
		endpoint: string
		data?: BodyInit
		headers?: Record<string, string>
		fullUrl?: string
		skipCookie?: boolean
	}): ResultAsync<T, BilibiliApiError> {
		return this.request<T>({
			endpoint,
			options: {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					...headers,
				},
				body: data,
			},
			fullUrl,
			skipCookie,
		})
	}

	/**
	 * 自动处理 CSRF token 并发送 POST 请求 (x-www-form-urlencoded)
	 */
	public postWithCsrf<T>({
		endpoint,
		payload = {},
	}: {
		endpoint: string
		payload?: Record<string, string>
	}): ResultAsync<T, BilibiliApiError> {
		return getCsrfToken().asyncAndThen((csrfToken) => {
			const dataWithCsrf = {
				...payload,
				csrf: csrfToken,
			}

			const body = new URLSearchParams(dataWithCsrf).toString()

			return this.post<T>({ endpoint, data: body })
		})
	}
}

export const bilibiliApiClient = new ApiClient()
