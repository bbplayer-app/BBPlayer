import type { PropsWithChildren } from 'react'
import { useContext } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FULLSCREEN_ROUTES } from '@/components/navigation/NavigationRail'
import { NativeTabRailWidthContext } from '@/hooks/ui/useResponsiveLayout'

import ResponsiveContent from './ResponsiveContent'

function ResponsiveScreenContent({
	children,
	routeName,
}: PropsWithChildren<{ routeName: string }>) {
	const { colors } = useTheme()

	// Fullscreen and overlay routes own their bounds; native tabs constrain each page.
	if (['(tabs)', 'player', 'modal', 'onboarding', 'test'].includes(routeName)) {
		return <>{children}</>
	}

	return (
		<View style={[styles.screen, { backgroundColor: colors.background }]}>
			<View style={[styles.screen, styles.row]}>
				<ResponsiveContent>{children}</ResponsiveContent>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	screen: { flex: 1 },
	row: { width: '100%', alignSelf: 'center', flexDirection: 'row' },
})

export default function ResponsiveScreen(
	props: PropsWithChildren<{ routeName: string }>,
) {
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const railWidth = useContext(NativeTabRailWidthContext)

	// Transparent modals must preserve the page and bounds underneath them.
	if (props.routeName === 'modal') return <>{props.children}</>
	// 根布局的导航栏覆盖在左侧；普通页面给它让出位置，全屏页面（播放器等）铺满。
	const reservedRail = FULLSCREEN_ROUTES.has(props.routeName) ? 0 : railWidth

	return (
		<View
			style={{
				flex: 1,
				paddingLeft: insets.left + reservedRail,
				paddingRight: insets.right,
				// 让出的区域与导航栏同色：打开播放器时导航栏隐藏，底层页面不会露出空白。
				backgroundColor:
					reservedRail > 0 ? colors.elevation.level1 : colors.background,
			}}
		>
			<View style={[styles.screen, { backgroundColor: colors.background }]}>
				<ResponsiveContent>
					<ResponsiveScreenContent {...props} />
				</ResponsiveContent>
			</View>
		</View>
	)
}
