import MaskedView from '@react-native-masked-view/masked-view'
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

const TAB_ICON_SIZE = 70
export const SKIN_BOTTOM_TAB_BAR_HEIGHT = 64

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
		<MaskedView
			style={[styles.container, { height: tabBarHeight }]}
			onLayout={() => setTabBarHeight?.(tabBarHeight)}
			maskElement={
				<Image
					source={skin.tabBar.background}
					style={StyleSheet.absoluteFill}
					contentFit='cover'
					cachePolicy='memory-disk'
				/>
			}
		>
			<Image
				source={skin.tabBar.background}
				style={StyleSheet.absoluteFill}
				contentFit='cover'
				cachePolicy='memory-disk'
			/>
			<View style={[styles.items, { paddingBottom: insets.bottom }]}>
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
		</MaskedView>
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
			// 聚焦时从下方浮入正常位置（+8→0），而不是整体偏移
			{ translateY: (1 - progress.value) * 8 },
			{ scale: 0.95 + progress.value * 0.05 },
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
		width: '100%',
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
