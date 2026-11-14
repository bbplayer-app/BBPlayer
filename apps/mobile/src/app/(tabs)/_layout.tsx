import MaterialIcon from '@react-native-vector-icons/material-design-icons'
import { NativeTabs } from 'expo-router/native-tabs'
import type { NativeTabTriggerProps } from 'expo-router/native-tabs'
import { useContext } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { NativeTabRailWidthContext } from '@/hooks/ui/useResponsiveLayout'

const searchIcon = MaterialIcon.getImageSourceSync('magnify', 24)
const libraryIcon = MaterialIcon.getImageSourceSync('bookshelf', 24)
const profileIcon = MaterialIcon.getImageSourceSync('account', 24)

type SkinIcon = { default: string | null; selected: string | null }

function originalAndroidIcons(
	icon: SkinIcon | undefined,
	colors: MD3Theme['colors'],
): NativeTabTriggerProps['unstable_nativeProps'] {
	if (!icon?.default || !icon.selected) return undefined

	return {
		android: {
			// Theme artwork needs a larger canvas than Material's default 24dp icons.
			standardAppearance: {
				tabBarItemIconSize: 50,
				// Fit the artwork into the standard 80dp bar by reducing vertical padding.
				tabBarItemPaddingTop: 3,
				tabBarItemPaddingBottom: 7,
				tabBarBackgroundColor: colors.elevation.level1,
				tabBarItemRippleColor: colors.primary,
				// Keep the indicator's ripple mask while hiding its selected background.
				tabBarItemActiveIndicatorEnabled: true,
				tabBarItemActiveIndicatorColor: 'transparent',
				// Match RNBT's Material indicator instead of scaling it with the artwork.
				tabBarItemActiveIndicatorWidth: 64,
				tabBarItemActiveIndicatorHeight: 32,
				normal: {
					tabBarItemTitleFontColor: colors.onSurfaceVariant,
					tabBarItemIconColor: colors.onSurfaceVariant,
				},
				selected: {
					tabBarItemTitleFontColor: colors.primary,
					tabBarItemIconColor: colors.primary,
				},
			},
			icon: {
				type: 'imageSource',
				imageSource: { uri: icon.default },
				tinting: 'original',
			},
			selectedIcon: {
				type: 'imageSource',
				imageSource: { uri: icon.selected },
				tinting: 'original',
			},
		},
	}
}

function iconSource(icon: SkinIcon | undefined, fallback: ImageSourcePropType) {
	return {
		default: icon?.default ? { uri: icon.default } : fallback,
		selected: icon?.selected ? { uri: icon.selected } : fallback,
	}
}

function nativeIconProps(
	icon: SkinIcon | undefined,
	fallback: ImageSourcePropType,
	colors: MD3Theme['colors'],
): NativeTabTriggerProps['unstable_nativeProps'] {
	const source = iconSource(icon, fallback)

	return {
		...originalAndroidIcons(icon, colors),
		ios: {
			icon: {
				type: 'imageSource',
				imageSource: source.default,
				renderingMode: icon?.default ? 'original' : 'template',
			},
			selectedIcon: {
				type: 'imageSource',
				imageSource: source.selected,
				renderingMode: icon?.selected ? 'original' : 'template',
			},
		},
	}
}

export default function TabLayout() {
	const { colors } = useTheme()
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	// 宽屏导航栏由根布局渲染；此时隐藏底部 Tab 栏。
	const showRail = useContext(NativeTabRailWidthContext) > 0

	const icons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons

	const useSkinTabs = Boolean(
		icons?.home.default &&
		icons.home.selected &&
		icons.library.default &&
		icons.library.selected &&
		icons.settings.default &&
		icons.settings.selected,
	)

	// NativeTabPage's safe area is a margin, so this shows around iOS's floating tab bar.
	const contentStyle = { backgroundColor: colors.background }

	return (
		<View style={styles.layout}>
			<NativeTabs
				hidden={showRail}
				tintColor={colors.primary}
				backgroundColor={colors.elevation.level1}
				iconColor={{
					default: colors.onSurfaceVariant,
					selected: colors.primary,
				}}
				labelStyle={{
					default: { color: colors.onSurfaceVariant },
					selected: { color: colors.primary },
				}}
				indicatorColor={useSkinTabs ? 'transparent' : colors.secondaryContainer}
				minimizeBehavior='never'
				backBehavior='initialRoute'
			>
				<NativeTabs.Trigger
					name='index'
					testID='tab-search'
					disableAutomaticContentInsets
					contentStyle={contentStyle}
					unstable_nativeProps={nativeIconProps(
						icons?.home,
						searchIcon,
						colors,
					)}
				>
					<NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon
						src={iconSource(icons?.home, searchIcon)}
						renderingMode={icons?.home.default ? 'original' : 'template'}
					/>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger
					name='library/[tab]'
					testID='tab-library'
					disableAutomaticContentInsets
					contentStyle={contentStyle}
					unstable_nativeProps={nativeIconProps(
						icons?.library,
						libraryIcon,
						colors,
					)}
				>
					<NativeTabs.Trigger.Label>音乐库</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon
						src={iconSource(icons?.library, libraryIcon)}
						renderingMode={icons?.library.default ? 'original' : 'template'}
					/>
				</NativeTabs.Trigger>
				<NativeTabs.Trigger
					name='my'
					testID='tab-my'
					disableAutomaticContentInsets
					contentStyle={contentStyle}
					unstable_nativeProps={nativeIconProps(
						icons?.settings,
						profileIcon,
						colors,
					)}
				>
					<NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon
						src={iconSource(icons?.settings, profileIcon)}
						renderingMode={icons?.settings.default ? 'original' : 'template'}
					/>
				</NativeTabs.Trigger>
			</NativeTabs>
		</View>
	)
}

const styles = StyleSheet.create({
	layout: { flex: 1, minWidth: 0 },
})
