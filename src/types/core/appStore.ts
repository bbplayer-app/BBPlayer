import type { Result } from 'neverthrow'

interface Settings {
	/**
	 * 向 bilibili 发送播放记录
	 */
	sendPlayHistory: boolean
	/**
	 * 启用 Sentry 错误报告
	 */
	enableSentryReport: boolean
	/**
	 * 打开 DEBUG 等级日志
	 */
	enableDebugLog: boolean
	/**
	 * 恢复旧版歌词样式
	 */
	enableOldSchoolStyleLyric: boolean
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
	setEnableSendPlayHistory: (value: boolean) => void
	setEnableSentryReport: (value: boolean) => void
	setEnableDebugLog: (value: boolean) => void
	setEnableOldSchoolStyleLyric: (value: boolean) => void
}

export type { AppState, Settings }
