import { storage } from '@/utils/mmkv'

const TOKEN_KEY = 'bbplayer_jwt'

export function getAuthToken(): string | undefined {
	return storage.getString(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
	storage.set(TOKEN_KEY, token)
}

export function clearAuthToken(): void {
	storage.remove(TOKEN_KEY)
}
