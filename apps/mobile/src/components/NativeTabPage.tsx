import { useFocusEffect } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ViewInstance } from 'react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { SafeAreaView } from 'react-native-screens/experimental'

import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'
import { NativeTabRailWidthContext } from '@/hooks/ui/useResponsiveLayout'

import ResponsiveContent from './layout/ResponsiveContent'

/** Measures the native tab safe area for the player overlay at the app root. */
export default function NativeTabPage({ children }: PropsWithChildren) {
	const { colors } = useTheme()
	const railWidth = useContext(NativeTabRailWidthContext)
	const contentRef = useRef<ViewInstance>(null)
	const { height: windowHeight } = useWindowDimensions()
	const [bottomTabBarHeight, setBottomTabBarHeight] = useState(0)

	const measureContent = useCallback(() => {
		contentRef.current?.measureInWindow((_x, y, _width, height) => {
			if (height > 0)
				setBottomTabBarHeight(Math.max(0, windowHeight - y - height))
		})
	}, [windowHeight])

	useFocusEffect(
		useCallback(() => {
			measureContent()
		}, [measureContent]),
	)
	// A side rail has no bottom tab bar. Let the docked player's background
	// cover the gesture area and apply its safe inset inside the player itself.
	useNowPlayingBar(undefined, railWidth > 0 ? 0 : bottomTabBarHeight)

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={{ bottom: true }}
			insetType='all'
		>
			<View
				ref={contentRef}
				collapsable={false}
				style={styles.container}
				onLayout={measureContent}
			>
				<ResponsiveContent>{children}</ResponsiveContent>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({ container: { flex: 1 } })
