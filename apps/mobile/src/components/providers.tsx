import { useMMKVDevTools } from '@rozenite/mmkv-plugin'
import { useRequireProfilerDevTools } from '@rozenite/require-profiler-plugin'
import { useTanStackQueryDevTools } from '@rozenite/tanstack-query-plugin'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { ShimmerProvider } from 'react-native-fast-shimmer'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import GlobalErrorFallback from '@/components/ErrorBoundary'
import { queryClient } from '@/lib/config/queryClient'
import { buildMaterial3PaperColors } from '@/lib/theme/material3Colors'
import { storage } from '@/utils/mmkv'

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

	useTanStackQueryDevTools(queryClient)
	useMMKVDevTools({
		storages: {
			// @ts-expect-error
			app: storage,
		},
	})
	useRequireProfilerDevTools()

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
