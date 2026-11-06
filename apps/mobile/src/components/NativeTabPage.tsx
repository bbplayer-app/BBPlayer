import { useFocusEffect } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { useCallback, useRef, useState } from 'react'
import type { ViewInstance } from 'react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'

import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'

/** Measures the native tab safe area for the player overlay at the app root. */
export default function NativeTabPage({ children }: PropsWithChildren) {
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
	useNowPlayingBar(undefined, bottomTabBarHeight)

	return (
		<SafeAreaView
			style={styles.container}
			edges={{ bottom: true }}
			insetType='all'
		>
			<View
				ref={contentRef}
				collapsable={false}
				style={styles.container}
				onLayout={measureContent}
			>
				{children}
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({ container: { flex: 1 } })
