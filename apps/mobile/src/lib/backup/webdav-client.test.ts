import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import {
	configureWebDavTransport,
	createWebDavClient,
} from './webdav-client.js'
import type { WebDavFetch } from './webdav-client.js'

const MULTISTATUS = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/BBPlayer/</d:href>
    <d:propstat><d:prop><d:displayname>BBPlayer</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/BBPlayer/backup-%E6%B5%8B%E8%AF%95.bbplayer</d:href>
    <d:propstat><d:prop><d:displayname>backup-测试.bbplayer</d:displayname><d:resourcetype/><d:getcontentlength>123</d:getcontentlength><d:getlastmodified>Wed, 20 Aug 2026 10:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
</d:multistatus>`

const DEFAULT_STAT = `<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:"><response><href>/dav/</href><propstat><prop><displayname>dav</displayname><resourcetype><collection/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`

describe('mobile WebDAV client', () => {
	beforeEach(() => {
		jest.restoreAllMocks()
	})

	it('requires an explicitly configured transport', async () => {
		await expect(
			Promise.resolve().then(() =>
				createWebDavClient({ baseUrl: 'https://dav.example.com' }),
			),
		).rejects.toMatchObject({ kind: 'protocol' })
	})

	it('rejects invalid XML entity expansion limits', () => {
		configureWebDavTransport(jest.fn<WebDavFetch>())
		expect(() =>
			createWebDavClient({
				baseUrl: 'https://dav.example.com',
				xmlEntityExpansionLimits: {
					maxTotalExpansions: 0,
					maxExpandedLength: 50_000,
				},
			}),
		).toThrow(expect.objectContaining({ kind: 'protocol' }))
	})

	it('lists entries with Basic auth and decodes Unicode paths', async () => {
		const fetchMock = jest.fn<WebDavFetch>(async (_input, init) => {
			expect(init?.method).toBe('PROPFIND')
			expect(new Headers(init?.headers).get('Authorization')).toBe(
				`Basic ${btoa('alice:secret')}`,
			)
			return new Response(MULTISTATUS, {
				status: 207,
				headers: { 'Content-Type': 'application/xml' },
			})
		})
		configureWebDavTransport(fetchMock)
		const client = createWebDavClient({
			baseUrl: 'https://dav.example.com/dav/',
			username: 'alice',
			password: 'secret',
		})

		await expect(client.listDirectory('/BBPlayer')).resolves.toEqual([
			expect.objectContaining({
				name: 'backup-测试.bbplayer',
				path: '/BBPlayer/backup-测试.bbplayer',
				size: 123,
				type: 'file',
			}),
		])
	})

	it('creates a missing Unicode directory recursively', async () => {
		const fetchMock = jest
			.fn<WebDavFetch>()
			.mockResolvedValueOnce(new Response('', { status: 404 }))
			.mockResolvedValueOnce(new Response('', { status: 201 }))
		configureWebDavTransport(fetchMock)
		const client = createWebDavClient({
			baseUrl: 'https://dav.example.com/dav',
		})

		await client.ensureDirectory('/备份')

		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav/%E5%A4%87%E4%BB%BD/',
			expect.objectContaining({ method: 'MKCOL' }),
		)
	})

	it('uploads and downloads ArrayBuffer data', async () => {
		const uploaded = Uint8Array.from([1, 2, 3]).buffer
		const downloaded = Uint8Array.from([4, 5, 6]).buffer
		const fetchMock = jest
			.fn<WebDavFetch>()
			.mockResolvedValueOnce(new Response('', { status: 201 }))
			.mockResolvedValueOnce(new Response(downloaded, { status: 200 }))
		configureWebDavTransport(fetchMock)
		const client = createWebDavClient({
			baseUrl: 'https://dav.example.com/dav',
		})

		await client.uploadFile('/BBPlayer/backup.bbplayer', uploaded)
		await expect(
			client.downloadFile('/BBPlayer/backup.bbplayer'),
		).resolves.toEqual(downloaded)
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'https://dav.example.com/dav/BBPlayer/backup.bbplayer',
			expect.objectContaining({ method: 'PUT', body: uploaded }),
		)
	})

	it('automatically retries a Digest challenge', async () => {
		const fetchMock = jest.fn<WebDavFetch>(async (_input, init) => {
			const authorization = new Headers(init?.headers).get('Authorization')
			if (authorization?.startsWith('Digest ')) {
				return new Response(DEFAULT_STAT, {
					status: 207,
					headers: { 'Content-Type': 'application/xml' },
				})
			}
			return new Response('', {
				status: 401,
				headers: {
					'WWW-Authenticate':
						'Digest realm="dav", nonce="abc", qop="auth", algorithm=MD5',
				},
			})
		})
		configureWebDavTransport(fetchMock)
		const client = createWebDavClient({
			baseUrl: 'https://dav.example.com/dav',
			username: 'alice',
			password: 'secret',
		})

		await client.checkConnection()

		expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
		const lastCall = fetchMock.mock.calls.at(-1)
		expect(new Headers(lastCall?.[1]?.headers).get('Authorization')).toMatch(
			/^Digest /,
		)
	})

	for (const [status, kind] of [
		[401, 'authentication'],
		[403, 'permission'],
		[404, 'not-found'],
		[500, 'protocol'],
	] as const) {
		it(`normalizes HTTP ${status} errors as ${kind}`, async () => {
			configureWebDavTransport(
				jest.fn<WebDavFetch>().mockResolvedValue(new Response('', { status })),
			)
			const client = createWebDavClient({ baseUrl: 'https://dav.example.com' })

			await expect(client.checkConnection()).rejects.toEqual(
				expect.objectContaining({ kind, status }),
			)
		})
	}

	it('normalizes transport failures', async () => {
		configureWebDavTransport(
			jest.fn<WebDavFetch>().mockRejectedValue(new TypeError('offline')),
		)
		const client = createWebDavClient({ baseUrl: 'https://dav.example.com' })

		await expect(client.checkConnection()).rejects.toMatchObject({
			kind: 'network',
		})
	})
})
