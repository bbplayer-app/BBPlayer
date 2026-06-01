import type { Result } from 'neverthrow'

interface Settings {
	sendPlayHistory: boolean
	enableDebugLog: boolean
	enableOldSchoolStyleLyric: boolean
	enableSpectrumVisualizer: boolean
	playerBackgroundStyle: 'gradient' | 'md3'
	nowPlayingBarStyle: 'float' | 'bottom'
	lyricSource: 'auto' | 'netease' | 'qqmusic' | 'kugou'
	enableVerbatimLyrics: boolean
	enableDataCollection: boolean
	enableDanmaku: boolean
	danmakuFilterLevel: number
	downloadMaxParallelTasks: number
	enableMinimalistMode: boolean
}

interface BilibiliUserSummary {
	mid?: number
	name?: string
	face?: string
	cachedAt?: number
}

interface BBPlayerAccount {
	id: string
	username: string
	name: string
	face?: string | null
}

interface AppState {
	bilibiliCookie: Record<string, string> | null
	bilibiliUserInfo: BilibiliUserSummary | null
	bbplayerToken: string | null
	bbplayerAccount: BBPlayerAccount | null
	settings: Settings

	// Cookies
	hasBilibiliCookie: () => boolean
	setBilibiliCookie: (cookieString: string) => Result<void, Error>
	updateBilibiliCookie: (updates: Record<string, string>) => Result<void, Error>
	clearBilibiliCookie: () => void
	setBilibiliUserInfo: (info: BilibiliUserSummary | null) => void

	// Auth
	setBbplayerToken: (token: string) => void
	setBBPlayerAccount: (account: BBPlayerAccount | null) => void
	clearBbplayerToken: () => void
	clearBBPlayerAccount: () => void

	// Settings
	setSettings: (updates: Partial<Settings>) => void

	setEnableDebugLog: (value: boolean) => void
	setEnableDataCollection: (value: boolean) => void
}

export type { AppState, BBPlayerAccount, BilibiliUserSummary, Settings }
