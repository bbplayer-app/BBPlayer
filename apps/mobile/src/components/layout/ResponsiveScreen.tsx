import type { PropsWithChildren } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useResponsiveLayout } from '@/hooks/ui/useResponsiveLayout'

import ResponsiveContent from './ResponsiveContent'
import SettingsNavigation from './SettingsNavigation'

function ResponsiveScreenContent({
	children,
	routeName,
}: PropsWithChildren<{ routeName: string }>) {
	const { colors } = useTheme()
	const { width } = useResponsiveLayout()
	// Fullscreen and overlay routes own their bounds; native tabs constrain each page.
	if (['(tabs)', 'player', 'modal', 'onboarding', 'test'].includes(routeName)) {
		return <>{children}</>
	}
	const showSettingsNavigation =
		width >= 1000 &&
		routeName.startsWith('settings/') &&
		routeName !== 'settings/index'
	return (
		<View style={[styles.screen, { backgroundColor: colors.background }]}>
			<View style={[styles.screen, styles.row]}>
				{showSettingsNavigation && (
					<ScrollView style={{ width: 240, flexGrow: 0 }}>
						<SettingsNavigation routeName={routeName} />
					</ScrollView>
				)}
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
	return (
		<View
			style={{
				flex: 1,
				paddingLeft: insets.left,
				paddingRight: insets.right,
				backgroundColor: colors.background,
			}}
		>
			<ResponsiveContent>
				<ResponsiveScreenContent {...props} />
			</ResponsiveContent>
		</View>
	)
}
