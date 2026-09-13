import type {
	NativeBottomTabNavigationEventMap,
	NativeBottomTabNavigationOptions,
} from '@bottom-tabs/react-navigation'
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation'
import Icon from '@react-native-vector-icons/material-design-icons'
import { useRouter, withLayoutContext } from 'expo-router'
import type {
	ParamListBase,
	TabNavigationState,
} from 'expo-router/react-navigation'
import { useEffect, useRef } from 'react'
import { useTheme } from 'react-native-paper'

import useAppStore from '@/hooks/stores/useAppStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

const BottomTabNavigator = createNativeBottomTabNavigator().Navigator

const Tabs = withLayoutContext<
	NativeBottomTabNavigationOptions,
	typeof BottomTabNavigator,
	TabNavigationState<ParamListBase>,
	NativeBottomTabNavigationEventMap
>(BottomTabNavigator)

interface nonNullableIcon {
	uri: string
	scale: number
}

const homeIcon = Icon.getImageSourceSync('home', 24) as nonNullableIcon
const libraryIcon = Icon.getImageSourceSync('bookshelf', 24) as nonNullableIcon
const settingsIcon = Icon.getImageSourceSync('cog', 24) as nonNullableIcon

export default function TabLayout() {
	const themes = useTheme().colors
	const startupScreen = useAppStore((state) => state.settings.startupScreen)
	const router = useRouter()
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const skinIcons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons
	const useSkinTabs = Boolean(
		skinIcons?.home.default &&
		skinIcons.home.selected &&
		skinIcons.library.default &&
		skinIcons.library.selected &&
		skinIcons.settings.default &&
		skinIcons.settings.selected,
	)

	// 修复：expo-router 在冷启动时会用 URL 推导的初始路由覆盖「initialRouteName」，
	// 导致「设置-通用-启动时进入-音乐库」重启后不生效。
	// 这里改为在 tab 布局首次挂载后，按该设置定向到对应 tab。
	const hasAppliedStartupScreen = useRef(false)
	useEffect(() => {
		if (hasAppliedStartupScreen.current) return
		hasAppliedStartupScreen.current = true
		const screen = useAppStore.getState().settings.startupScreen
		if (screen === 'library') {
			// 「0」对应音乐库内层的默认「播放列表」页
			router.navigate('/library/0')
		}
	}, [router])

	return (
		<Tabs
			disablePageAnimations
			disableTintColor={useSkinTabs}
			iconSize={useSkinTabs ? 50 : undefined}
			tabBarActiveTintColor={themes.primary}
			activeIndicatorColor={'transparent'}
			tabBarStyle={{ backgroundColor: themes.elevation.level1 }}
			initialRouteName={startupScreen === 'library' ? 'library/[tab]' : 'index'}
		>
			<Tabs.Screen
				name='index'
				options={{
					title: '主页',
					tabBarIcon: ({ focused }) => {
						const icon = focused
							? skinIcons?.home.selected
							: skinIcons?.home.default
						return icon ? { uri: icon, scale: 1 } : homeIcon
					},
					tabBarLabel: '主页',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='library/[tab]'
				options={{
					title: '音乐库',
					tabBarIcon: ({ focused }) => {
						const icon = focused
							? skinIcons?.library.selected
							: skinIcons?.library.default
						return icon ? { uri: icon, scale: 1 } : libraryIcon
					},
					tabBarLabel: '音乐库',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='settings/index'
				options={{
					title: '设置',
					tabBarIcon: ({ focused }) => {
						const icon = focused
							? skinIcons?.settings.selected
							: skinIcons?.settings.default
						return icon ? { uri: icon, scale: 1 } : settingsIcon
					},
					tabBarLabel: '设置',
					lazy: true,
				}}
			/>
		</Tabs>
	)
}
