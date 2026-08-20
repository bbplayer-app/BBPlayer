import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const storageData = new Map<string, string>()
const createClientMock = jest.fn()
const configureTransportMock = jest.fn()
const getSecureItemMock = jest.fn<() => Promise<string | null>>()
const setSecureItemMock = jest.fn<() => Promise<void>>()

jest.mock('./webdav-client', () => ({
	configureWebDavTransport: configureTransportMock,
	createWebDavClient: createClientMock,
}))

jest.mock('expo-secure-store', () => ({
	getItemAsync: getSecureItemMock,
	setItemAsync: setSecureItemMock,
}))

jest.mock('@/utils/mmkv', () => ({
	storage: {
		getString: (key: string) => storageData.get(key),
		set: (key: string, value: string) => storageData.set(key, value),
	},
}))

const {
	createMobileWebDavClient,
	getStoredWebDavConfig,
	joinWebDavPath,
	normalizeDirectory,
	saveWebDavConfig,
} = jest.requireActual<typeof import('./webdav')>('./webdav')

describe('mobile WebDAV configuration', () => {
	beforeEach(() => {
		storageData.clear()
		jest.clearAllMocks()
		getSecureItemMock.mockResolvedValue(null)
		setSecureItemMock.mockResolvedValue()
	})

	it('normalizes directories and joins remote paths', () => {
		expect(normalizeDirectory(' //我的备份// ')).toBe('/我的备份')
		expect(joinWebDavPath('/我的备份/', 'backup.bbplayer')).toBe(
			'/我的备份/backup.bbplayer',
		)
	})

	it('persists only non-sensitive configuration in MMKV', async () => {
		await saveWebDavConfig(
			{
				baseUrl: ' https://dav.example.com ',
				username: ' alice ',
				directory: 'BBPlayer',
			},
			'secret',
		)

		expect(getStoredWebDavConfig()).toEqual({
			baseUrl: 'https://dav.example.com',
			username: 'alice',
			directory: '/BBPlayer',
		})
		expect(storageData).toEqual(
			new Map([
				['webdav_backup_url', 'https://dav.example.com'],
				['webdav_backup_username', 'alice'],
				['webdav_backup_directory', '/BBPlayer'],
			]),
		)
		expect([...storageData.values()]).not.toContain('secret')
		expect(setSecureItemMock).toHaveBeenCalledWith(
			'bbplayer.webdav.password',
			'secret',
		)
	})

	it('keeps the existing SecureStore password when the input is blank', async () => {
		await saveWebDavConfig({
			baseUrl: 'https://dav.example.com',
			username: 'alice',
			directory: '/BBPlayer',
		})

		expect(setSecureItemMock).not.toHaveBeenCalled()
	})

	it('uses the stored password when creating a client', async () => {
		const expectedClient = { checkConnection: jest.fn() }
		getSecureItemMock.mockResolvedValue('saved-secret')
		createClientMock.mockReturnValue(expectedClient)

		await expect(
			createMobileWebDavClient({
				baseUrl: 'https://dav.example.com',
				username: 'alice',
				directory: '/BBPlayer',
			}),
		).resolves.toBe(expectedClient)
		expect(createClientMock).toHaveBeenCalledWith({
			baseUrl: 'https://dav.example.com',
			username: 'alice',
			password: 'saved-secret',
		})
	})

	it('requires both a username and a password', async () => {
		await expect(
			createMobileWebDavClient({
				baseUrl: 'https://dav.example.com',
				username: '',
				directory: '/BBPlayer',
			}),
		).rejects.toThrow('WebDAV 用户名和密码不能为空')
	})
})
