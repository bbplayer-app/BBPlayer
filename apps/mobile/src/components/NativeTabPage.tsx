import { useFocusEffect, useIsFocused } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ViewInstance } from 'react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { SafeAreaView } from 'react-native-screens/experimental'

import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'
import { NativeTabRailWidthContext } from '@/hooks/ui/useResponsiveLayout'

import ResponsiveContent from './layout/ResponsiveContent'

/**
 * Measures the native tab safe area for the player overlay at the app root.
 *
 * expo-router 的 NativeTabs 不支持懒加载，启动时会同时挂载所有 Tab。这里在 Tab 第一次获得焦点前
 * 不渲染页面内容，只有首屏那个 Tab 跟着启动挂载；挂载后不再卸载。
 */
export default function NativeTabPage({ children }: PropsWithChildren) {
	const { colors } = useTheme()
	const isFocused = useIsFocused()
	const [visited, setVisited] = useState(isFocused)

	if (isFocused && !visited) setVisited(true)

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
				<ResponsiveContent>{visited ? children : null}</ResponsiveContent>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({ container: { flex: 1 } })
