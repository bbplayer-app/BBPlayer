import * as SecureStore from 'expo-secure-store'

import { storage } from '@/utils/mmkv'

import { configureWebDavTransport, createWebDavClient } from './webdav-client'
import type { WebDavClient } from './webdav-client'

const WEBDAV_CREDENTIAL_STORAGE_KEY = 'bbplayer.webdav.password'

configureWebDavTransport(globalThis.fetch)

export interface StoredWebDavConfig {
	baseUrl: string
	username: string
	directory: string
}

export function getStoredWebDavConfig(): StoredWebDavConfig | null {
	const baseUrl = storage.getString('webdav_backup_url')
	if (!baseUrl) return null
	return {
		baseUrl,
		username: storage.getString('webdav_backup_username') ?? '',
		directory: normalizeDirectory(
			storage.getString('webdav_backup_directory') ?? '/BBPlayer',
		),
	}
}

export async function saveWebDavConfig(
	config: StoredWebDavConfig,
	password?: string,
): Promise<void> {
	storage.set('webdav_backup_url', config.baseUrl.trim())
	storage.set('webdav_backup_username', config.username.trim())
	storage.set('webdav_backup_directory', normalizeDirectory(config.directory))
	if (password) {
		await SecureStore.setItemAsync(WEBDAV_CREDENTIAL_STORAGE_KEY, password)
	}
}

export function getWebDavPassword(): Promise<string | null> {
	return SecureStore.getItemAsync(WEBDAV_CREDENTIAL_STORAGE_KEY)
}

export async function createMobileWebDavClient(
	config: StoredWebDavConfig,
	password?: string,
): Promise<WebDavClient> {
	const effectivePassword = password || (await getWebDavPassword()) || undefined
	const username = config.username.trim()
	if (!username || !effectivePassword) {
		throw new Error('WebDAV 用户名和密码不能为空')
	}
	return createWebDavClient({
		baseUrl: config.baseUrl,
		username,
		password: effectivePassword,
	})
}

export function normalizeDirectory(value: string): string {
	const segments = value
		.trim()
		.split('/')
		.filter((segment) => segment.length > 0)
	return `/${segments.join('/') || 'BBPlayer'}`
}

export function joinWebDavPath(directory: string, name: string): string {
	return `${normalizeDirectory(directory)}/${name}`
}
