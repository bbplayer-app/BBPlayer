import { alert } from '@/components/modals/AlertModal'
import { expoDb } from '@/lib/db/db'
import type { AppState, Settings } from '@/types/core/appStore'
import type { StorageKey } from '@/types/storage'
import log from '@/utils/log'
import { storage, zustandStorage } from '@/utils/mmkv'
import * as parseCookie from 'cookie'
import * as Expo from 'expo'
import { err, ok, type Result } from 'neverthrow'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const logger = log.extend('Store.App')

export const parseCookieToObject = (
	cookie?: string,
): Result<Record<string, string>, Error> => {
	if (!cookie?.trim()) {
		return ok({})
	}
	try {
		const cookieObj = parseCookie.parse(cookie)
		for (const value of Object.values(cookieObj)) {
			if (value === undefined) {
				return err(new Error(`无效的 cookie 字符串：值为 undefined：${value}`))
			}
		}
		return ok(cookieObj as Record<string, string>)
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
		.map(([key, value]) => parseCookie.serialize(key, value))
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
					enableSentryReport: true,
					enableDebugLog: false,
					enableOldSchoolStyleLyric: false,
					playerBackgroundStyle: 'gradient',
					enablePersistCurrentPosition: false,
				},

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
					return ok(undefined)
				},

				updateBilibiliCookie: (updates) => {
					const currentCookie = get().bilibiliCookie ?? {}
					const newCookie = { ...currentCookie, ...updates }

					set((state) => {
						state.bilibiliCookie = newCookie
					})
					return ok(undefined)
				},

				clearBilibiliCookie: () => {
					set((state) => {
						state.bilibiliCookie = null
					})
				},

				setSettings: (updates) => {
					set((state) => {
						Object.assign(state.settings, updates)
					})
				},

				setEnableSentryReport: (value) => {
					set((state) => {
						state.settings.enableSentryReport = value
					})

					alert(
						'重启？',
						'切换 Sentry 上报后，需要重启应用才能生效。',
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
				settings: state.settings,
			}),

			merge: (persistedState, currentState) => {
				if (persistedState) {
					return { ...currentState, ...(persistedState as Partial<AppState>) }
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
					checkAndSet(OLD_KEYS.SENTRY, 'enableSentryReport', 'boolean')
					checkAndSet(OLD_KEYS.DEBUG_LOG, 'enableDebugLog', 'boolean')
					checkAndSet(
						OLD_KEYS.OLD_LYRIC,
						'enableOldSchoolStyleLyric',
						'boolean',
					)
					checkAndSet(OLD_KEYS.BG_STYLE, 'playerBackgroundStyle', 'string')
					checkAndSet(
						OLD_KEYS.PERSIST_POSITION,
						'enablePersistCurrentPosition',
						'boolean',
					)
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
