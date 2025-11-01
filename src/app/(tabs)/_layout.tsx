import type {
	NativeBottomTabNavigationEventMap,
	NativeBottomTabNavigationOptions,
} from '@bottom-tabs/react-navigation'
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation'
import Icon from '@react-native-vector-icons/material-design-icons'
import type {
	ParamListBase,
	TabNavigationState,
} from '@react-navigation/native'
import { withLayoutContext } from 'expo-router'
import { useTheme } from 'react-native-paper'

const BottomTabNavigator = createNativeBottomTabNavigator().Navigator

export const unstable_settings = {
	initialRouteName: 'home',
}

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

	return (
		<Tabs
			disablePageAnimations
			tabBarActiveTintColor={themes.primary}
			activeIndicatorColor={themes.primaryContainer}
			tabBarStyle={{ backgroundColor: themes.elevation.level1 }}
			initialRouteName='Home'
		>
			<Tabs.Screen
				name='Home'
				options={{
					title: '主页',
					tabBarIcon: () => homeIcon,
					tabBarLabel: '主页',
					lazy: false,
				}}
			/>
			<Tabs.Screen
				name='Library'
				options={{
					title: '音乐库',
					tabBarIcon: () => libraryIcon,
					tabBarLabel: '音乐库',
					lazy: false,
				}}
			/>
			<Tabs.Screen
				name='Settings'
				options={{
					title: '设置',
					tabBarIcon: () => settingsIcon,
					tabBarLabel: '设置',
					lazy: false,
				}}
			/>
		</Tabs>
	)
}
