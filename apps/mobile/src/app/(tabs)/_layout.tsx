import type {
	NativeBottomTabNavigationEventMap,
	NativeBottomTabNavigationOptions,
} from '@bottom-tabs/react-navigation'
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation'
import Icon from '@react-native-vector-icons/material-design-icons'
import { withLayoutContext } from 'expo-router'
import type {
	ParamListBase,
	TabNavigationState,
} from 'expo-router/react-navigation'
import { useTheme } from 'react-native-paper'

import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { skinImageSource } from '@/lib/theme/skins'

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
	const activeSkin = useActiveSkin()
	const useSkinTabs = activeSkin !== null

	return (
		<Tabs
			disablePageAnimations
			disableTintColor={useSkinTabs}
			iconSize={useSkinTabs ? 50 : undefined}
			tabBarActiveTintColor={themes.primary}
			activeIndicatorColor={'transparent'}
			tabBarStyle={{ backgroundColor: themes.elevation.level1 }}
			initialRouteName='index'
		>
			<Tabs.Screen
				name='index'
				options={{
					title: '主页',
					tabBarIcon: ({ focused }) =>
						activeSkin
							? skinImageSource(
									focused
										? activeSkin.tabBar.icons.home.selected
										: activeSkin.tabBar.icons.home.default,
								)
							: homeIcon,
					tabBarLabel: '主页',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='library/[tab]'
				options={{
					title: '音乐库',
					tabBarIcon: ({ focused }) =>
						activeSkin
							? skinImageSource(
									focused
										? activeSkin.tabBar.icons.library.selected
										: activeSkin.tabBar.icons.library.default,
								)
							: libraryIcon,
					tabBarLabel: '音乐库',
					lazy: true,
				}}
			/>
			<Tabs.Screen
				name='settings/index'
				options={{
					title: '设置',
					tabBarIcon: ({ focused }) =>
						activeSkin
							? skinImageSource(
									focused
										? activeSkin.tabBar.icons.settings.selected
										: activeSkin.tabBar.icons.settings.default,
								)
							: settingsIcon,
					tabBarLabel: '设置',
					lazy: true,
				}}
			/>
		</Tabs>
	)
}
