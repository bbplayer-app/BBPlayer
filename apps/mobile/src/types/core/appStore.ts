import type { Result } from 'neverthrow'

interface Settings {
	sendPlayHistory: boolean
	enableSentryReport: boolean
	enableDebugLog: boolean
	enableOldSchoolStyleLyric: boolean
	enableSpectrumVisualizer: boolean
	playerBackgroundStyle: 'gradient' | 'md3'
	nowPlayingBarStyle: 'float' | 'bottom'
	lyricSource: 'auto' | 'netease' | 'qqmusic' | 'kuwo' | 'kugou' | 'baidu'
}

interface AppState {
	bilibiliCookie: Record<string, string> | null
	settings: Settings

	// Cookies
	hasBilibiliCookie: () => boolean
	setBilibiliCookie: (cookieString: string) => Result<void, Error>
	updateBilibiliCookie: (updates: Record<string, string>) => Result<void, Error>
	clearBilibiliCookie: () => void

	// Settings
	setSettings: (updates: Partial<Settings>) => void

	setEnableSentryReport: (value: boolean) => void
	setEnableDebugLog: (value: boolean) => void
}

export type { AppState, Settings }
