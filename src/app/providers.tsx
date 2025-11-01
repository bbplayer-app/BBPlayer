import GlobalErrorFallback from '@/components/ErrorBoundary'
import { queryClient } from '@/lib/config/queryClient'
import { useMaterial3Theme } from '@pchmn/expo-material3-theme'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { Slot } from 'expo-router'
import { ShareIntentProvider } from 'expo-share-intent'
import { useMemo } from 'react'
import { useColorScheme, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export function AppProviders({
	onLayoutRootView,
	appIsReady,
}: {
	onLayoutRootView: () => void
	appIsReady: boolean
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

	if (!appIsReady) {
		return null
	}

	return (
		<ShareIntentProvider>
			<SafeAreaProvider>
				<View
					onLayout={onLayoutRootView}
					style={{ flex: 1 }}
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
						<GestureHandlerRootView style={{ flex: 1 }}>
							<QueryClientProvider client={queryClient}>
								<PaperProvider theme={paperTheme}>
									<Slot />
								</PaperProvider>
							</QueryClientProvider>
						</GestureHandlerRootView>
					</Sentry.ErrorBoundary>
					<SystemBars style='auto' />
				</View>
			</SafeAreaProvider>
		</ShareIntentProvider>
	)
}
