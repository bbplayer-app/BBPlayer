import { Image } from 'expo-image'
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs'
import { BottomTabBarHeightCallbackContext } from 'expo-router/build/react-navigation/bottom-tabs'
import { useContext, useEffect } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { skinImageSource } from '@/lib/theme/skins'

const TAB_ICON_SIZE = 58
export const SKIN_BOTTOM_TAB_BAR_HEIGHT = 92

export default function SkinBottomTabBar({
	state,
	descriptors,
	navigation,
}: BottomTabBarProps) {
	const skin = useActiveSkin()
	const insets = useSafeAreaInsets()
	const setTabBarHeight = useContext(BottomTabBarHeightCallbackContext)

	if (!skin) return null

	const tabBarHeight = SKIN_BOTTOM_TAB_BAR_HEIGHT + insets.bottom

	return (
		<View
			style={[
				styles.container,
				{
					height: tabBarHeight,
					paddingBottom: insets.bottom,
				},
			]}
			onLayout={() => setTabBarHeight?.(tabBarHeight)}
		>
			<Image
				source={skin.tabBar.background}
				style={StyleSheet.absoluteFill}
				contentFit='cover'
				cachePolicy='memory-disk'
			/>
			<View style={styles.items}>
				{state.routes.map((route, index) => {
					const focused = state.index === index
					const descriptor = descriptors[route.key]
					const options = descriptor.options
					const label =
						typeof options.tabBarLabel === 'string'
							? options.tabBarLabel
							: (options.title ?? route.name)
					const icon =
						route.name === 'index'
							? focused
								? skin.tabBar.icons.home.selected
								: skin.tabBar.icons.home.default
							: route.name === 'library/[tab]'
								? focused
									? skin.tabBar.icons.library.selected
									: skin.tabBar.icons.library.default
								: focused
									? skin.tabBar.icons.settings.selected
									: skin.tabBar.icons.settings.default

					return (
						<SkinTabButton
							key={route.key}
							focused={focused}
							icon={skinImageSource(icon)}
							label={label}
							testID={options.tabBarButtonTestID}
							onPress={() => {
								const event = navigation.emit({
									type: 'tabPress',
									target: route.key,
									canPreventDefault: true,
								})

								if (!focused && !event.defaultPrevented) {
									navigation.navigate(route.name, route.params)
								}
							}}
							onLongPress={() => {
								navigation.emit({
									type: 'tabLongPress',
									target: route.key,
								})
							}}
						/>
					)
				})}
			</View>
		</View>
	)
}

function SkinTabButton({
	focused,
	icon,
	label,
	testID,
	onPress,
	onLongPress,
}: {
	focused: boolean
	icon: ImageSourcePropType
	label: string
	testID?: string
	onPress: () => void
	onLongPress: () => void
}) {
	const progress = useSharedValue(focused ? 1 : 0)

	useEffect(() => {
		progress.value = withTiming(focused ? 1 : 0, {
			duration: 260,
			easing: Easing.out(Easing.cubic),
		})
	}, [focused, progress])

	const iconStyle = useAnimatedStyle(() => ({
		opacity: 0.72 + progress.value * 0.28,
		transform: [
			{ translateY: 8 - progress.value * 12 },
			{ scale: 0.92 + progress.value * 0.1 },
		],
	}))

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityState={focused ? { selected: true } : {}}
			accessibilityLabel={label}
			testID={testID}
			style={styles.item}
			onPress={onPress}
			onLongPress={onLongPress}
		>
			<Animated.Image
				source={icon}
				style={[styles.icon, iconStyle]}
				resizeMode='contain'
			/>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		overflow: 'hidden',
		backgroundColor: 'transparent',
	},
	items: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	item: {
		flex: 1,
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	icon: {
		width: TAB_ICON_SIZE,
		height: TAB_ICON_SIZE,
		marginTop: -14,
	},
})
