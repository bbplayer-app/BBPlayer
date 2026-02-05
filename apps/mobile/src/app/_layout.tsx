import { useLogger } from '@react-navigation/devtools'
import { Orpheus } from '@roitium/expo-orpheus'
import * as Sentry from '@sentry/react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'
import * as Network from 'expo-network'
import { Stack, useNavigationContainerRef, SplashScreen } from 'expo-router'
import * as Updates from 'expo-updates'
import { useEffect, useState } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState, Platform, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { Toaster } from 'sonner-native'

import AppProviders from '@/components/providers'
import useCheckUpdate from '@/hooks/app/useCheckUpdate'
import { useFastMigrations } from '@/hooks/app/useFastMigrations'
import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { initializeSentry } from '@/lib/config/sentry'
import drizzleDb from '@/lib/db/db'
import lyricService from '@/lib/services/lyricService'
import { ProjectScope } from '@/types/core/scope'
import { toastAndLogError } from '@/utils/error-handling'
import log, { cleanOldLogFiles, reportErrorToSentry } from '@/utils/log'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'

import migrations from '../../drizzle/migrations'

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
	const [isReady, setIsReady] = useState(false)
	const { success: migrationsSuccess, error: migrationsError } =
		useFastMigrations(drizzleDb, migrations)
	const open = useModalStore((state) => state.open)
	const ref = useNavigationContainerRef()
	useCheckUpdate()

	useLogger(ref)

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
		try {
			useAppStore.getState()
			global.isUIReady = true

			// 清理旧日志
			cleanOldLogFiles(7)
				.andTee((deleted) => {
					if (deleted > 0) {
						logger.info(`已清理 ${deleted} 个旧日志文件`)
					}
				})
				.orTee((e) => {
					logger.warning('清理旧日志失败', { error: e.message })
				})

			// 迁移旧格式歌词
			void lyricService.migrateFromOldFormat()

			// 初始化播放器状态
			usePlayerStore.getState().initialize()

			// 初始化播放器 Cookie
			try {
				const cookie = useAppStore.getState().bilibiliCookie
				if (cookie) {
					logger.debug('初始化 orpheus bilibili cookie')
					Orpheus.setBilibiliCookie(serializeCookieObject(cookie))
				} else {
					logger.info('没有 bilibili cookie，跳过播放器初始化')
				}
			} catch (error) {
				logger.error('播放器初始化失败: ', error)
				reportErrorToSentry(error, '播放器初始化失败', ProjectScope.Player)
			}
		} catch (error) {
			logger.error('初始化失败:', error)
			reportErrorToSentry(error, '初始化失败', ProjectScope.UI)
		} finally {
			// eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
			setIsReady(true)
		}
	}, [])

	useEffect(() => {
		if (isReady && migrationsSuccess) {
			SplashScreen.hide()

			const firstOpen = storage.getBoolean('first_open') ?? true
			if (firstOpen) {
				open('Welcome', undefined, { dismissible: false })
			}
		}
	}, [isReady, migrationsSuccess, open])

	useEffect(() => {
		if (migrationsError) {
			SplashScreen.hide()
			logger.error('数据库迁移失败：', migrationsError)
		}
	}, [migrationsError])

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

	if (migrationsError) {
		return (
			<View style={styles.errorContainer}>
				<Text>数据库迁移失败: {migrationsError?.message}</Text>
				<Text>建议截图报错信息，发到项目 issues 反馈</Text>
			</View>
		)
	}

	if (!migrationsSuccess || !isReady) {
		return null
	}

	return (
		<AppProviders>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen
					name='(tabs)'
					options={{ headerShown: false }}
				/>

				<Stack.Screen
					name='player'
					options={{
						presentation: 'transparentModal',
						gestureEnabled: false,
						animation: 'none',
						headerShown: false,
					}}
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
					name='modal'
					options={{
						presentation: 'transparentModal',
						gestureEnabled: false,
						animation: 'fade',
						headerShown: false,
					}}
				/>
				<Stack.Screen
					name='playlist/remote/toview'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='comments/[bvid]'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='comments/reply'
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name='playlist/external-sync'
					options={{ headerShown: false }}
				/>
			</Stack>
			<Toaster />
		</AppProviders>
	)
})

const styles = StyleSheet.create({
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
})
