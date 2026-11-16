import { setFocusRingColor } from '@bbplayer/native'
import { Orpheus } from '@bbplayer/orpheus'
import { useRequireProfilerDevTools } from '@rozenite/require-profiler-plugin'
import {
	createMMKVStorageAdapter,
	useRozeniteStoragePlugin,
} from '@rozenite/storage-plugin'
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	AppState,
	Appearance,
	Platform,
	StyleSheet,
	useColorScheme,
	View,
} from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useMMKVBoolean } from 'react-native-mmkv'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RNShake from 'react-native-shake'

import GlobalErrorFallback from '@/components/ErrorBoundary'
import { alert } from '@/components/modals/AlertModal'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import {
	captureProfiling,
	PROFILING_DURATION_MS,
	SHAKE_PROFILING_KEY,
} from '@/lib/performance'
import {
	buildMaterial3PaperColors,
	buildPureWhitePaperColors,
} from '@/lib/theme/material3Colors'
import { storage } from '@/utils/mmkv'
import { mmkv } from '@/utils/mmkv-instance'

function DevTools() {
	useTanStackQueryDevTools(queryClient)
	useRozeniteStoragePlugin({
		storages: [
			createMMKVStorageAdapter({
				storages: {
					app: storage,
				},
			}),
		],
	})
	useRequireProfilerDevTools()

	return null
}

function ShakeProfiler() {
	const promptVisibleRef = useRef(false)
	const [enabled] = useMMKVBoolean(SHAKE_PROFILING_KEY, mmkv)

	const [isAppActive, setIsAppActive] = useState(
		AppState.currentState === 'active',
	)

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			setIsAppActive(state === 'active')
		})

		return () => subscription.remove()
	}, [])

	useEffect(() => {
		// RNShake 只要有监听者就一直持有加速度计，退到后台也不释放，
		// 会让主线程每秒被唤醒十几次。所以只在开关打开且位于前台时注册。
		if (!enabled || !isAppActive) return

		const subscription = RNShake.addListener(() => {
			if (promptVisibleRef.current) return
			promptVisibleRef.current = true

			alert(
				'记录性能分析',
				'是否记录接下来 10 秒的性能分析？完成后会保存到 Downloads 文件夹。',
				[
					{
						text: '取消',
						onPress: () => {
							promptVisibleRef.current = false
							useModalStore.getState().close('Alert')
						},
					},
					{
						text: '开始记录',
						onPress: () => {
							promptVisibleRef.current = false
							void captureProfiling(PROFILING_DURATION_MS)
						},
					},
				],
			)
		})

		return () => subscription.remove()
	}, [enabled, isAppActive])

	return null
}

export default function AppProviders({ children }: { children: ReactNode }) {
	const colorScheme = useColorScheme()

	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)

	useEffect(() => {
		if (Platform.OS === 'android') {
			Orpheus.isNotificationArtworkEnabled = !pureWhiteBackground
		}
	}, [pureWhiteBackground])
	useEffect(() => {
		// 同步原生控件、系统菜单，以及仍读取 useColorScheme 的组件。
		Appearance.setColorScheme(pureWhiteBackground ? 'light' : 'unspecified')

		return () => Appearance.setColorScheme('unspecified')
	}, [pureWhiteBackground])

	const paperTheme = useMemo(
		() =>
			pureWhiteBackground
				? { ...MD3LightTheme, colors: buildPureWhitePaperColors() }
				: colorScheme === 'dark'
					? {
							...MD3DarkTheme,
							colors: buildMaterial3PaperColors(colorScheme ?? 'light'),
						}
					: {
							...MD3LightTheme,
							colors: buildMaterial3PaperColors(colorScheme ?? 'light'),
						},
		[colorScheme, pureWhiteBackground],
	)

	useEffect(() => {
		// 遥控器 / 键盘导航时的焦点框跟随主题色。
		setFocusRingColor(paperTheme.colors.primary)
	}, [paperTheme.colors.primary])

	return (
		<SafeAreaProvider>
			<KeyboardProvider>
				<View
					style={[
						styles.container,
						{ backgroundColor: paperTheme.colors.background },
					]}
				>
					<Sentry.ErrorBoundary
						// oxlint-disable-next-line @typescript-eslint/unbound-method
						fallback={({ error, resetError }) => (
							<GlobalErrorFallback
								error={error}
								resetError={resetError}
							/>
						)}
					>
						<GestureHandlerRootView style={styles.container}>
							<QueryClientProvider client={queryClient}>
								<PaperProvider theme={paperTheme}>
									{__DEV__ ? <DevTools /> : null}
									<ShakeProfiler />
									{children}
								</PaperProvider>
							</QueryClientProvider>
						</GestureHandlerRootView>
					</Sentry.ErrorBoundary>
					<SystemBars style={pureWhiteBackground ? 'dark' : 'auto'} />
				</View>
			</KeyboardProvider>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
})
