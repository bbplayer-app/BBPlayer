import { storage } from '@/utils/mmkv'

const KUGOU_TOKEN_KEY = 'playlistout_kugou_token' as const
const KUGOU_USERID_KEY = 'playlistout_kugou_userid' as const
const IMPORT_MODE_KEY = 'playlistout_import_mode' as const

export type PlaylistOutImportMode = 'smart' | 'legacy'

export interface KugouCredentials {
	token: string
	userid: string
}

/**
 * Parses composite credentials input (JSON format or token:userid delimiter)
 */
export function parseKugouCredentialsInput(
	input: string,
): KugouCredentials | null {
	const trimmed = input.trim()
	if (!trimmed) return null

	// JSON format: {"token":"...","userid":"..."}
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		try {
			const obj = JSON.parse(trimmed)
			if (obj && typeof obj === 'object') {
				return {
					token: String(
						obj.token || obj.kugou_token || obj.kugouToken || '',
					).trim(),
					userid: String(
						obj.userid || obj.kugou_userid || obj.kugouUserid || obj.uid || '',
					).trim(),
				}
			}
		} catch {
			// fallback
		}
	}

	// Delimited: token:userid or userid:token (colon, comma, or pipe)
	if (trimmed.includes(':') || trimmed.includes(',') || trimmed.includes('|')) {
		const parts = trimmed
			.split(/[:|,]/)
			.map((s) => s.trim())
			.filter(Boolean)
		if (parts.length >= 2) {
			const p0 = parts[0]
			const p1 = parts[1]
			if (/^\d{5,12}$/.test(p0) && !/^\d{5,12}$/.test(p1)) {
				return { userid: p0, token: p1 }
			} else if (/^\d{5,12}$/.test(p1) && !/^\d{5,12}$/.test(p0)) {
				return { token: p0, userid: p1 }
			} else {
				return { token: p0, userid: p1 }
			}
		}
	}

	return null
}

export const playlistOutStorage = {
	getKugouToken(): string {
		return storage.getString(KUGOU_TOKEN_KEY) ?? ''
	},

	setKugouToken(token: string): void {
		const trimmed = token.trim()
		if (!trimmed) {
			storage.remove(KUGOU_TOKEN_KEY)
			return
		}

		const parsed = parseKugouCredentialsInput(trimmed)
		if (parsed) {
			if (parsed.token) storage.set(KUGOU_TOKEN_KEY, parsed.token)
			if (parsed.userid) storage.set(KUGOU_USERID_KEY, parsed.userid)
			return
		}

		storage.set(KUGOU_TOKEN_KEY, trimmed)
	},

	getKugouUserid(): string {
		return storage.getString(KUGOU_USERID_KEY) ?? ''
	},

	setKugouUserid(userid: string): void {
		const trimmed = userid.trim()
		if (!trimmed) {
			storage.remove(KUGOU_USERID_KEY)
		} else {
			storage.set(KUGOU_USERID_KEY, trimmed)
		}
	},

	setKugouCredentials(token: string, userid: string): void {
		const cleanToken = token.trim()
		const cleanUserid = userid.trim()

		const parsedToken = parseKugouCredentialsInput(cleanToken)
		const parsedUserid = parseKugouCredentialsInput(cleanUserid)

		const finalToken = parsedToken?.token || parsedUserid?.token || cleanToken
		const finalUserid =
			parsedToken?.userid || parsedUserid?.userid || cleanUserid

		if (finalToken) {
			storage.set(KUGOU_TOKEN_KEY, finalToken)
		} else {
			storage.remove(KUGOU_TOKEN_KEY)
		}

		if (finalUserid) {
			storage.set(KUGOU_USERID_KEY, finalUserid)
		} else {
			storage.remove(KUGOU_USERID_KEY)
		}
	},

	clearKugouCredentials(): void {
		storage.remove(KUGOU_TOKEN_KEY)
		storage.remove(KUGOU_USERID_KEY)
	},

	isKugouConfigured(): {
		configured: boolean
		hasToken: boolean
		hasUserid: boolean
	} {
		const token = (storage.getString(KUGOU_TOKEN_KEY) ?? '').trim()
		const userid = (storage.getString(KUGOU_USERID_KEY) ?? '').trim()
		return {
			configured: Boolean(token && userid),
			hasToken: Boolean(token),
			hasUserid: Boolean(userid),
		}
	},

	getImportMode(): PlaylistOutImportMode {
		const val = storage.getString(IMPORT_MODE_KEY)
		return val === 'legacy' ? 'legacy' : 'smart'
	},

	setImportMode(mode: PlaylistOutImportMode): void {
		storage.set(IMPORT_MODE_KEY, mode)
	},
}
