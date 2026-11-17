import { Orpheus } from '@bbplayer/orpheus'
import {
	addEventListener as addNetInfoEventListener,
	fetch as fetchNetInfo,
} from '@react-native-community/netinfo'
import * as Sentry from '@sentry/react-native'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { AppMetricsRoot } from 'expo-app-metrics'
import { router, Stack } from 'expo-router'
import * as Updates from 'expo-updates'
import { useEffect, useState } from 'react'
import type { AppStateStatus } from 'react-native'
import { AppState, Platform, StyleSheet, View } from 'react-native'
import { hide as hideBootSplash } from 'react-native-bootsplash'
import { Text } from 'react-native-paper'
import { Toaster } from 'sonner-native'

import AnimatedBootSplash from '@/components/AnimatedBootSplash'
import ResponsiveScreen from '@/components/layout/ResponsiveScreen'
import { alert } from '@/components/modals/AlertModal'
import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import {
	NavigationRailOverlay,
	NavigationRailProvider,
} from '@/components/navigation/NavigationRail'
import NowPlayingBar from '@/components/NowPlayingBar'
import AppProviders from '@/components/providers'
import useCheckUpdate from '@/hooks/app/useCheckUpdate'
import { useDataCollectionSync } from '@/hooks/app/useDataCollectionSync'
import { useFastMigrations } from '@/hooks/app/useFastMigrations'
import { listenPlayerQueueChanges } from '@/hooks/queries/orpheus'
import {
	nowPlayingBarStore$,
	shouldHideNowPlayingBar,
} from '@/hooks/stores/nowPlayingBarStore'
import { initPlaybackContextStore } from '@/hooks/stores/playbackContextStore'
import { serializeCookieObject } from '@/hooks/stores/useAppStore'
import useAppStoreObj from '@/hooks/stores/useAppStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { initializeSentry } from '@/lib/config/sentry'
import drizzleDb from '@/lib/db/db'
import { runAfterStartup } from '@/lib/performance'
import { playerSideEffects } from '@/lib/player/PlayerSideEffects'
import { getLyricService } from '@/lib/services/getLyricService'
import { registerUpdatePrefetch } from '@/lib/services/updateService'
import {
	reportUpdateActivity,
	reportUpdateLaunch,
} from '@/lib/services/updateTelemetry'
import {
	endStartupPhase,
	flushStartupPhases,
	measureStartupPhase,
	startStartupPhase,
} from '@/lib/startupTrace'
import { playlistSyncWorker } from '@/lib/workers/PlaylistSyncWorker'
import { ProjectScope } from '@/types/core/scope'
import log, { cleanOldLogFiles, reportErrorToSentry } from '@/utils/log'
import { storage } from '@/utils/mmkv'
import { isActuallyOffline } from '@/utils/network'

import migrations from '../../drizzle/migrations'

const logger = log.extend('UI.RootLayout')

// 初始化 Sentry
initializeSentry()

function onAppStateChange(status: AppStateStatus) {
	if (Platform.OS !== 'web') {
		focusManager.setFocused(status === 'active')

		// metrics 有 5s 缓冲窗口，退到后台时确保启动数据已经发出
		if (status !== 'active') {
			void Sentry.flush()
		}
	}
}

const checkOverlayPermissionOnStart = async () => {
	if (Orpheus.isDesktopLyricsShown) {
		const hasPermission = await Orpheus.checkOverlayPermission()

		if (!hasPermission) {
			// 延迟显示，确保 UI 已经加载
			setTimeout(() => {
				alert(
					'桌面歌词',
					'检测到桌面歌词已开启，但缺少悬浮窗权限，请授权以恢复显示。',
					[
						{ text: '取消' },
						{
							text: '去授权',
							onPress: () => Orpheus.requestOverlayPermission(),
						},
					],
				)
			}, 1000)
		}
	}
}

/** 不影响首屏的启动任务，等首屏可交互后再执行 */
function runDeferredAppInit() {
	try {
		registerUpdatePrefetch()

		cleanOldLogFiles(7)
			.andTee((deleted) => {
				if (deleted > 0) {
					logger.info('logs.cleanup.completed', {
						'logs.deleted_count': deleted,
					})
				}
			})
			.orTee((e) => {
				logger.warning('logs.cleanup.failed', { 'error.message': e.message })
			})

		void getLyricService().migrateFromOldFormat()

		void checkOverlayPermissionOnStart()
	} catch (error) {
		logger.error('app.deferred_initialize_failed', {}, error)
		reportErrorToSentry(error, '延后的初始化任务失败', ProjectScope.UI)
	}
}

function runAppInit() {
	try {
		useAppStoreObj.getState()

		initPlaybackContextStore()
		usePlayerStore.getState().initialize()
		playerSideEffects.initialize()

		listenPlayerQueueChanges()

		runAfterStartup(runDeferredAppInit)

		try {
			const settings = useAppStoreObj.getState().settings
			void Orpheus.setDownloadMaxParallelTasks(
				settings.downloadMaxParallelTasks,
			)
			void Orpheus.setAllowSimultaneousPlayback(
				settings.allowSimultaneousPlayback,
			)
			const cookie = useAppStoreObj.getState().bilibiliCookie

			if (cookie) {
				logger.debug('player.cookie.initialize')
				Orpheus.setBilibiliCookie(serializeCookieObject(cookie))
			} else {
				logger.info('player.initialize.cookie_missing')
			}
		} catch (error) {
			logger.error('player.initialize.failed', {}, error)
			reportErrorToSentry(error, '播放器初始化失败', ProjectScope.Player)
		}
	} catch (error) {
		logger.error('app.initialize.failed', {}, error)
		reportErrorToSentry(error, '初始化失败', ProjectScope.UI)
	}
}

function RootLayout() {
	startStartupPhase('app.startup.root_mount')
	const [isReady, setIsReady] = useState(false)

	const { success: migrationsSuccess, error: migrationsError } =
		useFastMigrations(drizzleDb, migrations)

	useCheckUpdate()
	useDataCollectionSync()

	onlineManager.setEventListener((setOnline) => {
		void fetchNetInfo().then((state) => {
			setOnline(!isActuallyOffline(state))
		})

		return addNetInfoEventListener((state) => {
			setOnline(!isActuallyOffline(state))
		})
	})

	useEffect(() => {
		runAfterStartup(reportUpdateActivity)

		const subscription = AppState.addEventListener('change', onAppStateChange)

		return () => subscription.remove()
	}, [])

	useEffect(() => {
		endStartupPhase('app.startup.root_mount')
		measureStartupPhase('app.startup.init', runAppInit)
		// 首屏没能在超时前可交互（例如直接落地在非标签页）时，也把已经记下的阶段补记上去
		runAfterStartup(flushStartupPhases)
		// oxlint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state, set-state-in-effect
		setIsReady(true)
	}, [])

	useEffect(() => {
		if (__DEV__ || !Updates.isEnabled) {
			return
		}

		const listener = AppState.addEventListener('focus', () => {
			Updates.checkForUpdateAsync()
				.then((result) => {
					if (result.isAvailable) {
						logger.debug('update.ota.available', {
							'update.available': result.isAvailable,
						})
						Updates.fetchUpdateAsync().catch((e) => {
							logger.error('update.ota.download_failed', {}, e)
						})
					}
				})
				.catch((error: Error) => {
					logger.error('update.ota.check_failed', {}, error)
				})
		})

		return () => listener.remove()
	}, [])

	useEffect(() => {
		if (isReady && migrationsSuccess) {
			runAfterStartup(() => {
				reportUpdateLaunch()
				// 恢复上次被中断的同步任务（syncing → pending），并触发同步
				playlistSyncWorker.recoverStuckRows().catch((error) => {
					logger.error('playlist.sync.restore_failed', {}, error)
				})
			})

			const firstOpen = storage.getBoolean('first_open') ?? true

			if (firstOpen) {
				router.navigate('/onboarding')
			}
		}
	}, [isReady, migrationsSuccess])

	useEffect(() => {
		if (migrationsError) {
			void hideBootSplash({ fade: true })
			logger.error('database.migration.failed', {}, migrationsError)
		}
	}, [migrationsError])

	if (migrationsError) {
		return (
			<View style={styles.errorContainer}>
				<Text>数据库迁移失败: {migrationsError?.message}</Text>
				<Text>建议截图报错信息，发到项目 issues 反馈</Text>
			</View>
		)
	}

	// 在渲染路由前计时，子页面的 effect 可能先于本组件的 effect 报告可交互。
	if (migrationsSuccess && isReady) {
		startStartupPhase('app.startup.first_screen')
	}

	return (
		<View style={styles.appContainer}>
			<AppProviders>
				<NavigationRailProvider>
					{migrationsSuccess && isReady ? (
						<Stack
							screenLayout={({ children, route }) => (
								<ResponsiveScreen routeName={route.name}>
									{children}
								</ResponsiveScreen>
							)}
							screenOptions={{ headerShown: false }}
							screenListeners={({ route, navigation }) => ({
								focus: () => {
									// 进入隐藏页面时立即隐藏播放条；离开时不在这里恢复，
									// 而是等到 transitionEnd，行为与 player 页面一致。
									if (
										route.name !== 'modal' &&
										shouldHideNowPlayingBar(route.name)
									) {
										nowPlayingBarStore$.hiddenScreenActive.set(true)
									}
								},
								transitionEnd: ({ data }) => {
									const state = navigation.getState()

									// 被 pop 的页面已不在导航状态中，其 closing 事件会被丢弃。
									// 等当前目标页面 onAppear，且忽略旧页面迟到的转场事件。
									if (
										!data.closing &&
										state.routes[state.index]?.key === route.key
									) {
										// 返回动画结束后，才根据目标页面决定是否恢复播放条。
										if (route.name !== 'modal') {
											nowPlayingBarStore$.hiddenScreenActive.set(
												shouldHideNowPlayingBar(route.name),
											)
										}

										// Modal 需要沿用其底层页面的位置；其余非 Tab 页面不能
										// 继承此前 Tab 页留下的高度。
										if (route.name !== '(tabs)' && route.name !== 'modal') {
											nowPlayingBarStore$.retainedBottomTabBarHeight.set(0)
										}
									}
								},
							})}
						>
							<Stack.Screen
								name='(tabs)'
								options={{ headerShown: false }}
							/>

							<Stack.Screen
								name='performance'
								options={{ headerShown: false }}
							/>

							<Stack.Screen
								name='audio-debug'
								options={{ headerShown: false }}
							/>

							<Stack.Screen
								name='player'
								options={{
									animation: 'slide_from_bottom',
									headerShown: false,
								}}
							/>

							<Stack.Screen
								name='test'
								options={{ headerShown: false }}
							/>

							<Stack.Screen
								name='onboarding'
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
								name='playlist/remote/series/[id]'
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
								name='share/playlist'
								options={{ headerShown: false }}
							/>

							<Stack.Screen
								name='history/overall'
								options={{ headerShown: false }}
							/>
							<Stack.Screen
								name='history/[date]'
								options={{ headerShown: false }}
							/>
							<Stack.Screen
								name='download'
								options={{ headerShown: false }}
							/>
							<Stack.Screen
								name='following'
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
							<Stack.Screen
								name='settings'
								options={{ headerShown: false }}
							/>
						</Stack>
					) : null}
					{migrationsSuccess && isReady && <NavigationRailOverlay />}
					<Toaster />
					<PlayerQueueModal />
					<NowPlayingBar />
				</NavigationRailProvider>
			</AppProviders>
			<AnimatedBootSplash ready={isReady && migrationsSuccess} />
		</View>
	)
}

// 用户点击追踪（ui.action.touch）与触摸面包屑以 testID 作为元素标识。
// 同一节点上 testID 优先于 accessibilityLabel 与子节点文本；都没有时保留原始文本，
// 点击 transaction 名即 `{路由}.{元素标识}`
export default Sentry.wrap(AppMetricsRoot.wrap(RootLayout), {
	touchEventBoundaryProps: { labelName: 'testID' },
})

const styles = StyleSheet.create({
	appContainer: {
		flex: 1,
	},
	errorContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
})
