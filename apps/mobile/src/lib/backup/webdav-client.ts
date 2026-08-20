import {
	AuthType,
	createClient as createUpstreamClient,
	getPatcher,
} from 'webdav'
import type {
	FileStat,
	WebDAVClient as UpstreamClient,
	WebDAVClientError,
} from 'webdav'

export type WebDavFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>

export interface WebDavClientConfig {
	baseUrl: string
	username?: string
	password?: string
	xmlEntityExpansionLimits?: {
		maxTotalExpansions: number
		maxExpandedLength: number
	}
}

export interface WebDavEntry {
	path: string
	name: string
	type: 'file' | 'directory'
	size: number
	lastModified: Date | null
}

export type WebDavErrorKind =
	| 'authentication'
	| 'permission'
	| 'not-found'
	| 'network'
	| 'protocol'
	| 'unknown'

export class WebDavError extends Error {
	readonly kind: WebDavErrorKind
	readonly status?: number

	constructor(
		kind: WebDavErrorKind,
		message: string,
		options?: { cause?: unknown; status?: number },
	) {
		super(message, { cause: options?.cause })
		this.name = 'WebDavError'
		this.kind = kind
		this.status = options?.status
	}
}

export interface WebDavClient {
	checkConnection(path?: string): Promise<void>
	ensureDirectory(path: string): Promise<void>
	listDirectory(path: string): Promise<WebDavEntry[]>
	uploadFile(path: string, data: ArrayBuffer): Promise<void>
	downloadFile(path: string): Promise<ArrayBuffer>
}

let transportConfigured = false

/** Configure the HTTP transport before creating clients. */
export function configureWebDavTransport(
	fetchImplementation: WebDavFetch,
): void {
	getPatcher().patch(
		'fetch',
		fetchImplementation as (...args: unknown[]) => Promise<unknown>,
	)
	transportConfigured = true
}

export function createWebDavClient(config: WebDavClientConfig): WebDavClient {
	if (!transportConfigured) {
		throw new WebDavError(
			'protocol',
			'WebDAV transport is not configured. Call configureWebDavTransport first.',
		)
	}

	const baseUrl = validateBaseUrl(config.baseUrl)
	const xmlEntityExpansionLimits = validateXmlEntityExpansionLimits(
		config.xmlEntityExpansionLimits,
	)
	const createUpstream = (authType: AuthType) =>
		createUpstreamClient(baseUrl, {
			authType,
			username: config.username,
			password: config.password,
			entityDecoder: {
				limit: xmlEntityExpansionLimits,
			},
		})
	const hasCredentials = Boolean(config.username || config.password)

	return new WebDavClientAdapter(
		createUpstream(hasCredentials ? AuthType.Auto : AuthType.None),
		hasCredentials ? createUpstream(AuthType.Digest) : undefined,
	)
}

function validateXmlEntityExpansionLimits(
	limits: WebDavClientConfig['xmlEntityExpansionLimits'],
) {
	const value = limits ?? {
		maxTotalExpansions: 1000,
		maxExpandedLength: 50_000,
	}
	if (
		!Number.isSafeInteger(value.maxTotalExpansions) ||
		value.maxTotalExpansions <= 0 ||
		!Number.isSafeInteger(value.maxExpandedLength) ||
		value.maxExpandedLength <= 0
	) {
		throw new WebDavError(
			'protocol',
			'WebDAV XML entity expansion 限制必须是正整数',
		)
	}
	return value
}

class WebDavClientAdapter implements WebDavClient {
	constructor(
		private readonly client: UpstreamClient,
		private readonly digestFallback?: UpstreamClient,
	) {}

	async checkConnection(path = '/'): Promise<void> {
		await this.run(async (client) => {
			const stat = await client.stat(normalizePath(path))
			if ('data' in stat) {
				throw new WebDavError('protocol', 'WebDAV 返回了无效的目录信息')
			}
			if (stat.type !== 'directory') {
				throw new WebDavError('protocol', 'WebDAV 路径不是目录')
			}
		})
	}

	async ensureDirectory(path: string): Promise<void> {
		await this.run((client) =>
			client.createDirectory(normalizePath(path), { recursive: true }),
		)
	}

	async listDirectory(path: string): Promise<WebDavEntry[]> {
		return this.run(async (client) => {
			const entries = await client.getDirectoryContents(normalizePath(path), {
				includeSelf: false,
			})
			return entries.map(mapEntry)
		})
	}

	async uploadFile(path: string, data: ArrayBuffer): Promise<void> {
		await this.run(async (client) => {
			const uploaded = await client.putFileContents(normalizePath(path), data, {
				contentLength: data.byteLength,
				overwrite: true,
			})
			if (!uploaded) throw new WebDavError('protocol', 'WebDAV 文件上传失败')
		})
	}

	async downloadFile(path: string): Promise<ArrayBuffer> {
		return this.run(async (client) => {
			const data = await client.getFileContents(normalizePath(path), {
				format: 'binary',
			})
			if (
				typeof data === 'string' ||
				(!ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer))
			) {
				throw new WebDavError('protocol', 'WebDAV 返回了无效的二进制内容')
			}
			return toArrayBuffer(data)
		})
	}

	private async run<T>(
		operation: (client: UpstreamClient) => Promise<T>,
	): Promise<T> {
		try {
			return await operation(this.client)
		} catch (error) {
			if (error instanceof WebDavError) throw error
			if (
				findStatus(error as WebDAVClientError) === 401 &&
				this.digestFallback
			) {
				try {
					return await operation(this.digestFallback)
				} catch (digestError) {
					if (digestError instanceof WebDavError) throw digestError
					throw normalizeError(digestError)
				}
			}
			throw normalizeError(error)
		}
	}
}

function validateBaseUrl(value: string): string {
	try {
		const url = new URL(value.trim())
		if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error()
		return url.href.replace(/\/$/, '')
	} catch (error) {
		throw new WebDavError('protocol', 'WebDAV 服务器地址无效', { cause: error })
	}
}

function normalizePath(value: string): string {
	const segments = value
		.trim()
		.split('/')
		.filter((segment) => segment.length > 0 && segment !== '.')
	if (segments.some((segment) => segment === '..')) {
		throw new WebDavError('protocol', 'WebDAV 路径不能包含 ..')
	}
	return `/${segments.join('/')}`
}

function mapEntry(entry: FileStat): WebDavEntry {
	const lastModified = entry.lastmod ? new Date(entry.lastmod) : null
	return {
		path: entry.filename,
		name: entry.basename,
		type: entry.type,
		size: Number.isFinite(entry.size) ? entry.size : 0,
		lastModified:
			lastModified && !Number.isNaN(lastModified.getTime())
				? lastModified
				: null,
	}
}

function toArrayBuffer(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
	if (data instanceof ArrayBuffer) return data
	const copy = new Uint8Array(data.byteLength)
	copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
	return copy.buffer
}

function normalizeError(error: unknown): WebDavError {
	const upstream = error as WebDAVClientError | undefined
	const status = findStatus(upstream)
	const message = error instanceof Error ? error.message : '未知 WebDAV 错误'

	if (status === 401) {
		return new WebDavError('authentication', 'WebDAV 用户名或密码错误', {
			cause: error,
			status,
		})
	}
	if (status === 403) {
		return new WebDavError('permission', '没有访问 WebDAV 路径的权限', {
			cause: error,
			status,
		})
	}
	if (status === 404) {
		return new WebDavError('not-found', 'WebDAV 路径不存在', {
			cause: error,
			status,
		})
	}
	if (typeof status === 'number') {
		return new WebDavError('protocol', `WebDAV 请求失败（HTTP ${status}）`, {
			cause: error,
			status,
		})
	}
	if (error instanceof TypeError) {
		return new WebDavError('network', '无法连接到 WebDAV 服务器', {
			cause: error,
		})
	}
	return new WebDavError('unknown', message, { cause: error })
}

function findStatus(error: WebDAVClientError | undefined): number | undefined {
	if (typeof error?.status === 'number') return error.status
	if (typeof error?.response?.status === 'number') return error.response.status
	if (error?.cause && typeof error.cause === 'object') {
		return findStatus(error.cause as WebDAVClientError)
	}
	return undefined
}
