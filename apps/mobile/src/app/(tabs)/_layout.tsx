import Icon from '@react-native-vector-icons/material-design-icons'
import { NativeTabs } from 'expo-router/native-tabs'
import type { NativeTabTriggerProps } from 'expo-router/native-tabs'
import type { ImageSourcePropType } from 'react-native'
import { useTheme } from 'react-native-paper'

import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'

const searchIcon = Icon.getImageSourceSync('magnify', 24)
const libraryIcon = Icon.getImageSourceSync('bookshelf', 24)
const profileIcon = Icon.getImageSourceSync('account', 24)

type SkinIcon = { default: string | null; selected: string | null }

function originalAndroidIcons(
	icon: SkinIcon | undefined,
): NativeTabTriggerProps['unstable_nativeProps'] {
	if (!icon?.default || !icon.selected) return undefined
	return {
		android: {
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

export default function TabLayout() {
	const { colors } = useTheme()
	const activeSkin = useActiveSkin()
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const icons = activeSkin?.skins[activeSkinIndex]?.tabBar.icons
	const useSkinTabs = Boolean(
		icons?.home.default &&
		icons.home.selected &&
		icons.library.default &&
		icons.library.selected &&
		icons.settings.default &&
		icons.settings.selected,
	)

	return (
		<NativeTabs
			tintColor={colors.primary}
			backgroundColor={colors.elevation.level1}
			iconColor={{ default: colors.onSurfaceVariant, selected: colors.primary }}
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
				disableAutomaticContentInsets
				unstable_nativeProps={originalAndroidIcons(icons?.home)}
			>
				<NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					src={iconSource(icons?.home, searchIcon)}
					renderingMode={icons?.home.default ? 'original' : 'template'}
				/>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger
				name='library/[tab]'
				disableAutomaticContentInsets
				unstable_nativeProps={originalAndroidIcons(icons?.library)}
			>
				<NativeTabs.Trigger.Label>音乐库</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					src={iconSource(icons?.library, libraryIcon)}
					renderingMode={icons?.library.default ? 'original' : 'template'}
				/>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger
				name='my'
				disableAutomaticContentInsets
				unstable_nativeProps={originalAndroidIcons(icons?.settings)}
			>
				<NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					src={iconSource(icons?.settings, profileIcon)}
					renderingMode={icons?.settings.default ? 'original' : 'template'}
				/>
			</NativeTabs.Trigger>
		</NativeTabs>
	)
}
