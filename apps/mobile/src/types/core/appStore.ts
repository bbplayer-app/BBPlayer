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
}

interface BilibiliUserInfo {
	name?: string
	face?: string
}

interface AppState {
	bilibiliCookie: Record<string, string> | null
	bilibiliUserInfo: BilibiliUserInfo | null
	settings: Settings

	// Cookies
	hasBilibiliCookie: () => boolean
	setBilibiliCookie: (cookieString: string) => Result<void, Error>
	updateBilibiliCookie: (updates: Record<string, string>) => Result<void, Error>
	clearBilibiliCookie: () => void
	setBilibiliUserInfo: (info: BilibiliUserInfo | null) => void

	// Settings
	setSettings: (updates: Partial<Settings>) => void

	setEnableDebugLog: (value: boolean) => void
	setEnableDataCollection: (value: boolean) => void
}

export type { AppState, Settings }
