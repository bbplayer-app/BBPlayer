const TOKEN_KEY = 'bbplayer.admin.token'

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY)
}

export function saveToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
	localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
	onUnauthorized = handler
}

export function reportUnauthorized() {
	onUnauthorized?.()
}
