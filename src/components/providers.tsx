import GlobalErrorFallback from '@/components/ErrorBoundary'
import { queryClient } from '@/lib/config/queryClient'
import { useMaterial3Theme } from '@pchmn/expo-material3-theme'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { ShareIntentProvider } from 'expo-share-intent'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { ShimmerProvider } from 'react-native-fast-shimmer'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function AppProviders({
	onLayoutRootView,
	children,
}: {
	onLayoutRootView: () => void
	children: ReactNode
}) {
	const colorScheme = useColorScheme()
	const { theme } = useMaterial3Theme()
	const paperTheme = useMemo(
		() =>
			colorScheme === 'dark'
				? { ...MD3DarkTheme, colors: theme.dark }
				: { ...MD3LightTheme, colors: theme.light },
		[colorScheme, theme],
	)

	return (
		<ShareIntentProvider>
			<SafeAreaProvider>
				<KeyboardProvider>
					<View
						onLayout={onLayoutRootView}
						style={styles.container}
					>
						<Sentry.ErrorBoundary
							// eslint-disable-next-line @typescript-eslint/unbound-method
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
										<ShimmerProvider duration={1500}>
											{children}
										</ShimmerProvider>
									</PaperProvider>
								</QueryClientProvider>
							</GestureHandlerRootView>
						</Sentry.ErrorBoundary>
						<SystemBars style='auto' />
					</View>
				</KeyboardProvider>
			</SafeAreaProvider>
		</ShareIntentProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
})
