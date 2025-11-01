import { toastConfig } from '@/components/toast/ToastConfig'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useCheckUpdate from '@/hooks/useCheckUpdate'
import { initializeSentry } from '@/lib/config/sentry'
import drizzleDb, { expoDb } from '@/lib/db/db'
import { initPlayer } from '@/lib/player/playerLogic'
import lyricService from '@/lib/services/lyricService'
import { ProjectScope } from '@/types/core/scope'
import log, {
	cleanOldLogFiles,
	reportErrorToSentry,
	toastAndLogError,
} from '@/utils/log'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'
import * as Sentry from '@sentry/react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import * as Network from 'expo-network'
import { SplashScreen, Stack } from 'expo-router'
import { useSQLiteDevTools } from 'expo-sqlite-devtools'
import * as Updates from 'expo-updates'
import { useCallback, useEffect, useState } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState, Platform, View } from 'react-native'
import { Text } from 'react-native-paper'
import Toast from 'react-native-toast-message'
import migrations from '../../drizzle/migrations'
import { AppProviders } from './providers'

const logger = log.extend('UI.RootLayout')

// 在获取资源时保持启动画面可见
void SplashScreen.preventAutoHideAsync()

// 初始化 Sentry
initializeSentry()

const developement = process.env.NODE_ENV === 'development'

function onAppStateChange(status: AppStateStatus) {
	if (Platform.OS !== 'web') {
		focusManager.setFocused(status === 'active')
	}
}

export default Sentry.wrap(function RootLayout() {
	const [appIsReady, setAppIsReady] = useState(false)
	const { success: migrationsSuccess, error: migrationsError } = useMigrations(
		drizzleDb,
		migrations,
	)
	const open = useModalStore((state) => state.open)
	useCheckUpdate()

	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	useSQLiteDevTools(expoDb)

	onlineManager.setEventListener((setOnline) => {
		const eventSubscription = Network.addNetworkStateListener((state) => {
			setOnline(!!state.isConnected)
		})
		return eventSubscription.remove.bind(eventSubscription)
	})

	useEffect(() => {
		const subscription = AppState.addEventListener('change', onAppStateChange)
		return () => subscription.remove()
	}, [])

	useEffect(() => {
		const initializeApp = () => {
			try {
				useAppStore.getState()
			} catch (error) {
				logger.error('初始化 Zustand store 失败:', error)
				reportErrorToSentry(error, '初始化 Zustand store 失败', ProjectScope.UI)
			} finally {
				setAppIsReady(true)

				setImmediate(() => {
					void cleanOldLogFiles(7)
						.andTee((deleted) => {
							if (deleted > 0) {
								logger.info(`已清理 ${deleted} 个旧日志文件`)
							}
						})
						.orTee((e) => {
							logger.warning('清理旧日志失败', { error: e.message })
						})

					void lyricService.migrateFromOldFormat()

					const initializePlayer = async () => {
						if (!global.playerIsReady) {
							try {
								await initPlayer()
							} catch (error) {
								logger.error('播放器初始化失败: ', error)
								reportErrorToSentry(
									error,
									'播放器初始化失败',
									ProjectScope.Player,
								)
								global.playerIsReady = false
							}
						}
					}
					void initializePlayer()
				})
			}
		}

		void initializeApp()
	}, [])

	useEffect(() => {
		if (developement) {
			return
		}
		Updates.checkForUpdateAsync()
			.then((result) => {
				if (result.isAvailable) {
					toast.show('有新的热更新，将在下次启动时应用', {
						id: 'update',
					})
				}
			})
			.catch((error: Error) => {
				toastAndLogError('检测更新失败', error, 'UI.RootLayout')
			})
	}, [])

	const onLayoutRootView = useCallback(() => {
		if (appIsReady) {
			if (migrationsError) {
				// 当有错误时，表明迁移已经结束，需要隐藏 SplashScreen 展示错误信息
				SplashScreen.hide()
				logger.error('数据库迁移失败：', migrationsError)
			}
			if (migrationsSuccess) {
				SplashScreen.hide()
				logger.info('数据库迁移完成')
			}
			const firstOpen = storage.getBoolean('first_open') ?? true
			if (firstOpen) {
				open('Welcome', undefined, { dismissible: false })
			}
		}
	}, [appIsReady, migrationsError, migrationsSuccess, open])

	if (migrationsError) {
		logger.error('数据库迁移失败:', migrationsError)
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<Text>数据库迁移失败: {migrationsError?.message}</Text>
				<Text>建议截图报错信息，发到项目 issues 反馈</Text>
			</View>
		)
	}

	if (!migrationsSuccess || !appIsReady) {
		return null
	}

	return (
		<AppProviders onLayoutRootView={onLayoutRootView}>
			<Stack>
				<Stack.Screen
					name='(tabs)'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='player'
					options={{ animation: 'slide_from_bottom', headerShown: false }}
				/>
				<Stack.Screen
					name='test'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/remote/search-result/global/[query]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/remote/collection/[id]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/remote/favorite/[id]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/remote/multipage/[bvid]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/remote/uploader/[mid]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/remote/search-result/fav/[query]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/local/[id]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='leaderboard'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='download'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='+not-found'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='modal-host'
					options={{
						presentation: 'transparentModal',
						gestureEnabled: false,
						animation: 'fade',
						headerShown: false,
					}}
				/>
			</Stack>
			<Toast config={toastConfig} />
		</AppProviders>
	)
})
