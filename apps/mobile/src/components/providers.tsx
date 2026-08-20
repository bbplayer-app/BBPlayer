import { useMMKVDevTools } from '@rozenite/mmkv-plugin'
import { useRequireProfilerDevTools } from '@rozenite/require-profiler-plugin'
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { ShimmerProvider } from 'react-native-fast-shimmer'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RNShake from 'react-native-shake'

import GlobalErrorFallback from '@/components/ErrorBoundary'
import { alert } from '@/components/modals/AlertModal'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import {
	captureProfiling,
	isShakeProfilingEnabled,
	PROFILING_DURATION_MS,
} from '@/lib/performance'
import { buildMaterial3PaperColors } from '@/lib/theme/material3Colors'
import { storage } from '@/utils/mmkv'

function DevTools() {
	useTanStackQueryDevTools(queryClient)
	useMMKVDevTools({
		storages: {
			app: storage,
		},
	})
	useRequireProfilerDevTools()
	return null
}

function ShakeProfiler() {
	const promptVisibleRef = useRef(false)

	useEffect(() => {
		const subscription = RNShake.addListener(() => {
			if (!isShakeProfilingEnabled() || promptVisibleRef.current) return
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
	}, [])

	return null
}

export default function AppProviders({ children }: { children: ReactNode }) {
	const colorScheme = useColorScheme()
	const paperTheme = useMemo(
		() =>
			colorScheme === 'dark'
				? {
						...MD3DarkTheme,
						colors: buildMaterial3PaperColors(colorScheme),
					}
				: {
						...MD3LightTheme,
						colors: buildMaterial3PaperColors(colorScheme),
					},
		[colorScheme],
	)

	return (
		<SafeAreaProvider>
			<KeyboardProvider>
				<View style={styles.container}>
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
									<ShimmerProvider duration={1500}>{children}</ShimmerProvider>
								</PaperProvider>
							</QueryClientProvider>
						</GestureHandlerRootView>
					</Sentry.ErrorBoundary>
					<SystemBars style='auto' />
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
