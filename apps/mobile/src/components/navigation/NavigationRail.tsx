import { Image } from 'expo-image'
import { usePathname, useRouter, useSegments } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { useContext, useState } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { Icon, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import {
	NAVIGATION_RAIL_WIDTH,
	NativeTabRailWidthContext,
	useResponsiveLayout,
} from '@/hooks/ui/useResponsiveLayout'

/** 这些根路由自己占满整个屏幕，不给导航栏留位置，也不显示导航栏。 */
export const FULLSCREEN_ROUTES = new Set([
	'player',
	'onboarding',
	'test',
	'performance',
])

/** 根据窗口宽度决定是否启用导航栏，并把它的宽度提供给页面与播放条。 */
export function NavigationRailProvider({ children }: PropsWithChildren) {
	const { isTablet } = useResponsiveLayout()

	const railWidth =
		Platform.OS === 'android' && isTablet ? NAVIGATION_RAIL_WIDTH : 0

	return (
		<NativeTabRailWidthContext value={railWidth}>
			{children}
		</NativeTabRailWidthContext>
	)
}

/** 覆盖在根导航栈之上的导航栏；全屏页面（如播放器）打开时隐藏。 */
export function NavigationRailOverlay() {
	const railWidth = useContext(NativeTabRailWidthContext)
	const route = useSegments()[0] ?? ''
	// 弹窗路由叠在当前页面之上，导航栏沿用下面那个页面的显示状态。
	const [baseRoute, setBaseRoute] = useState(route)

	if (route !== 'modal' && route !== baseRoute) setBaseRoute(route)

	if (railWidth === 0 || FULLSCREEN_ROUTES.has(baseRoute)) return null

	return <NavigationRail style={styles.overlay} />
}

/**
 * 宽屏下的导航栏（Navigation Rail）。渲染在根布局，覆盖在所有页面的左侧，
 * 这样进入二级页面时导航栏保持不动、仍可随时切换 Tab。
 */
export default function NavigationRail({
	style,
}: {
	style?: StyleProp<ViewStyle>
}) {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const pathname = usePathname()

	const tabFromPath =
		pathname === '/'
			? 'search'
			: pathname.startsWith('/library')
				? 'library'
				: pathname === '/my'
					? 'my'
					: null

	// 进入二级页面后仍高亮最后所在的 Tab。
	const [lastTab, setLastTab] = useState('search')

	if (tabFromPath && tabFromPath !== lastTab) setLastTab(tabFromPath)
	const activeTab = tabFromPath ?? lastTab
	const router = useRouter()
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const icons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons

	return (
		<View
			accessibilityRole='tablist'
			style={[
				styles.rail,
				style,
				{
					backgroundColor: colors.elevation.level1,
					paddingTop: insets.top + 24,
				},
			]}
		>
			{[
				{
					label: '搜索',
					path: '/' as const,
					icon: 'magnify',
					skin: icons?.home,
					id: 'search',
					selected: activeTab === 'search',
				},
				{
					label: '音乐库',
					path: '/library/0' as const,
					icon: 'bookshelf',
					skin: icons?.library,
					id: 'library',
					selected: activeTab === 'library',
				},
				{
					label: '我的',
					path: '/my' as const,
					icon: 'account',
					skin: icons?.settings,
					id: 'my',
					selected: activeTab === 'my',
				},
			].map((tab) => (
				<Pressable
					key={tab.id}
					onPress={() => {
						// 从二级页面切 Tab 时先回到 Tab 页，而不是在当前页面之上再压一层。
						if (router.canDismiss()) router.dismissAll()
						router.navigate(tab.path)
					}}
					accessibilityRole='tab'
					accessibilityState={{ selected: tab.selected }}
					accessibilityLabel={tab.label}
					testID={`tablet-tab-${tab.id}`}
					style={styles.railTab}
				>
					{({ pressed }) => (
						<>
							<View
								collapsable={false}
								style={[
									styles.railIcon,
									{
										backgroundColor: tab.selected
											? colors.secondaryContainer
											: 'transparent',
									},
								]}
							>
								{tab.skin?.default ? (
									<Image
										source={{
											uri: tab.selected
												? (tab.skin.selected ?? tab.skin.default)
												: tab.skin.default,
										}}
										style={{ width: 48, height: 48 }}
										contentFit='contain'
									/>
								) : (
									<Icon
										source={tab.icon}
										size={24}
										color={
											tab.selected
												? colors.onSecondaryContainer
												: colors.onSurfaceVariant
										}
									/>
								)}
								{/* Material 3 的状态层：按下时叠一层半透明的前景色；遥控器焦点由原生焦点框绘制。 */}
								{pressed && (
									<View
										pointerEvents='none'
										style={[
											styles.stateLayer,
											{
												backgroundColor: tab.selected
													? colors.onSecondaryContainer
													: colors.onSurface,
											},
										]}
									/>
								)}
							</View>
							<Text
								variant='labelMedium'
								style={{
									color: tab.selected
										? colors.onSurface
										: colors.onSurfaceVariant,
								}}
							>
								{tab.label}
							</Text>
						</>
					)}
				</Pressable>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	overlay: { position: 'absolute', left: 0, top: 0, bottom: 0 },
	rail: { width: NAVIGATION_RAIL_WIDTH, gap: 12, paddingHorizontal: 8 },
	railTab: { alignItems: 'center', gap: 4, paddingVertical: 8 },
	railIcon: {
		width: 64,
		height: 48,
		borderRadius: 24,
		overflow: 'hidden',
		justifyContent: 'center',
		alignItems: 'center',
	},
	stateLayer: { ...StyleSheet.absoluteFill, opacity: 0.12 },
})
