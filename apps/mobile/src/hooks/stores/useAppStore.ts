import { Orpheus } from '@bbplayer/orpheus'
import * as parseCookie from 'cookie'
import * as Expo from 'expo'
import { err, ok, type Result } from 'neverthrow'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { alert } from '@/components/modals/AlertModal'
import { expoDb } from '@/lib/db/db'
import { analyticsService } from '@/lib/services/analyticsService'
import type { AppState, Settings } from '@/types/core/appStore'
import type { StorageKey } from '@/types/storage'
import log from '@/utils/log'
import { storage, zustandStorage } from '@/utils/mmkv'

const logger = log.extend('Store.App')

import toast from '@/utils/toast'

export const parseCookieToObject = (
	cookie?: string,
): Result<Record<string, string>, Error> => {
	if (!cookie?.trim()) {
		return ok({})
	}
	try {
		const cookieObj = parseCookie.parse(cookie)
		const sanitizedObj: Record<string, string> = {}
		let hasInvalidKeys = false

		for (const [key, value] of Object.entries(cookieObj)) {
			if (value === undefined) {
				return err(new Error(`无效的 cookie 字符串：值为 undefined：${value}`))
			}
			const trimmedKey = key.trim()
			const trimmedValue = value.trim()

			if (!trimmedKey) {
				continue
			}

			if (trimmedKey !== key || trimmedValue !== value) {
				hasInvalidKeys = true
			}

			sanitizedObj[trimmedKey] = trimmedValue
		}

		if (hasInvalidKeys) {
			toast.error('检测到 Cookie 包含无效字符（如换行符），已自动修复')
		}

		return ok(sanitizedObj)
	} catch (error) {
		return err(
			new Error(
				`无效的 cookie 字符串: ${error instanceof Error ? error.message : String(error)}`,
			),
		)
	}
}

export const serializeCookieObject = (
	cookieObj: Record<string, string>,
): string => {
	return Object.entries(cookieObj)
		.map(([key, value]) => {
			try {
				return parseCookie.serialize(key, value)
			} catch {
				try {
					return parseCookie.serialize(key.trim(), value.trim())
				} catch {
					return null
				}
			}
		})
		.filter((item) => item !== null)
		.join('; ')
}

const OLD_KEYS: Record<string, StorageKey> = {
	COOKIE: 'bilibili_cookie',
	SEND_HISTORY: 'send_play_history',
	SENTRY: 'enable_sentry_report',
	DEBUG_LOG: 'enable_debug_log',
	OLD_LYRIC: 'enable_old_school_style_lyric',
	BG_STYLE: 'player_background_style',
	PERSIST_POSITION: 'enable_persist_current_position',
}

export const useAppStore = create<AppState>()(
	persist(
		immer((set, get) => {
			return {
				bilibiliCookie: null,
				settings: {
					sendPlayHistory: false,
					enableDebugLog: false,
					enableOldSchoolStyleLyric: false,
					enableSpectrumVisualizer: false,
					playerBackgroundStyle: 'gradient',
					nowPlayingBarStyle: 'float',
					lyricSource: 'netease',
					enableVerbatimLyrics: true,
					enableDataCollection: true,
					enableDanmaku: false,
					danmakuFilterLevel: 0,
				},
				bilibiliUserInfo: null,

				hasBilibiliCookie: () => {
					const { bilibiliCookie } = get()
					return !!bilibiliCookie && Object.keys(bilibiliCookie).length > 0
				},

				setBilibiliCookie: (cookieString) => {
					const result = parseCookieToObject(cookieString)
					if (result.isErr()) {
						return err(result.error)
					}

					const cookieObj = result.value
					set((state) => {
						state.bilibiliCookie = cookieObj
					})
					Orpheus.setBilibiliCookie(serializeCookieObject(cookieObj))
					logger.info('设置 cookie 到 orpheus')
					return ok(undefined)
				},

				updateBilibiliCookie: (updates) => {
					const currentCookie = get().bilibiliCookie ?? {}
					const newCookie = { ...currentCookie, ...updates }

					set((state) => {
						state.bilibiliCookie = newCookie
					})
					Orpheus.setBilibiliCookie(serializeCookieObject(newCookie))
					logger.info('更新 cookie 到 orpheus')
					return ok(undefined)
				},

				clearBilibiliCookie: () => {
					set((state) => {
						state.bilibiliCookie = null
						state.bilibiliUserInfo = null
					})
				},

				setBilibiliUserInfo: (info) => {
					set((state) => {
						state.bilibiliUserInfo = info
					})
				},

				setSettings: (updates) => {
					set((state) => {
						Object.assign(state.settings, updates)
					})
				},

				setEnableDataCollection: (value: boolean) => {
					set((state) => {
						state.settings.enableDataCollection = value
					})
					void analyticsService.setAnalyticsCollectionEnabled(value)

					alert(
						'重启？',
						'切换隐私设置后，需要重启应用才能完全生效。',
						[
							{ text: '取消' },
							{
								text: '确定',
								onPress: () => {
									expoDb.closeSync()
									void Expo.reloadAppAsync()
								},
							},
						],
						{ cancelable: true },
					)
				},

				setEnableDebugLog: (value) => {
					set((state) => {
						state.settings.enableDebugLog = value
					})

					log.setSeverity(value ? 'debug' : 'info')
				},
			}
		}),
		{
			name: 'app-storage',
			storage: createJSONStorage(() => zustandStorage),
			version: 1,

			partialize: (state) => ({
				bilibiliCookie: state.bilibiliCookie,
				bilibiliUserInfo: state.bilibiliUserInfo,
				settings: state.settings,
			}),

			merge: (persistedState, currentState) => {
				if (persistedState) {
					const typedPersistedState = persistedState as AppState

					// @ts-expect-error -- handling migration of old keys
					// oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment
					const oldSentry = typedPersistedState.settings.enableSentryReport
					// @ts-expect-error -- handling migration of old keys
					// oxlint-disable-next-line @typescript-eslint/no-unsafe-assignment
					const oldAnalytics = typedPersistedState.settings.enableAnalytics

					const mergedState = {
						...currentState,
						...typedPersistedState,
						settings: {
							...currentState.settings,
							...typedPersistedState.settings,
						},
					}

					if (oldSentry === false || oldAnalytics === false) {
						mergedState.settings.enableDataCollection = false
					}
					// @ts-expect-error -- cleanup
					delete mergedState.settings.enableSentryReport
					// @ts-expect-error -- cleanup
					delete mergedState.settings.enableAnalytics

					return mergedState
				}

				logger.info('没找到 "app-storage" 存储项. 检查旧的 MMKV 键并尝试迁移')
				let hasOldData = false
				const migratedState = { ...currentState }

				try {
					const oldCookieStr = storage.getString('bilibili_cookie')
					if (oldCookieStr) {
						const cookieResult = parseCookieToObject(oldCookieStr)
						if (cookieResult.isOk()) {
							migratedState.bilibiliCookie = cookieResult.value
							hasOldData = true
						}
					}
				} catch (e) {
					logger.error('解析并迁移旧的 bilibili cookie 失败', e)
				}

				const migratedSettings = { ...currentState.settings }
				let hasOldSettings = false

				try {
					const checkAndSet = (
						key: StorageKey,
						settingName: keyof Settings,
						type: 'boolean' | 'string' | 'number',
					) => {
						let value
						switch (type) {
							case 'boolean':
								// @ts-expect-error -- ts 无法理解这里
								value = storage.getBoolean(key)
								break
							case 'string':
								// @ts-expect-error -- ts 无法理解这里
								value = storage.getString(key)
								break
							case 'number':
								// @ts-expect-error -- ts 无法理解这里
								value = storage.getNumber(key)
								break
							default:
								break
						}
						if (value !== undefined && value !== null) {
							// @ts-expect-error -- ts 无法理解这里
							migratedSettings[settingName] = value
							hasOldSettings = true
						}
					}

					checkAndSet(OLD_KEYS.SEND_HISTORY, 'sendPlayHistory', 'boolean')
					checkAndSet(OLD_KEYS.DEBUG_LOG, 'enableDebugLog', 'boolean')
					checkAndSet(
						OLD_KEYS.OLD_LYRIC,
						'enableOldSchoolStyleLyric',
						'boolean',
					)
					checkAndSet(OLD_KEYS.BG_STYLE, 'playerBackgroundStyle', 'string')
				} catch (e) {
					logger.error('迁移设置项失败', e)
				}

				if (hasOldSettings) {
					migratedState.settings = migratedSettings
					hasOldData = true
				}

				if (!hasOldData) {
					logger.info('没有旧数据，使用默认值')
					return currentState
				}

				logger.info('迁移旧数据成功！')
				return migratedState
			},
		},
	),
)

export default useAppStore
