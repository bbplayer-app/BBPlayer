import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Appbar,
	Divider,
	List,
	Searchbar as SearchBar,
	Text,
	useTheme,
} from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'

type LicenseEntry = {
	key: string
	name: string
	version?: string
	type?: string
	url?: string
	content?: string
	dependencyType?: string
}

type ExtraData = {
	selectedKey: string | null
	onPress: (key: string) => void
	onSurfaceVariant: string
}

const SEARCHBAR_HEIGHT = 72

// oxlint-disable-next-line @typescript-eslint/no-require-imports
const rawLicenses = require('@/assets/openSourceLicenses.json') as Record<
	string,
	Omit<LicenseEntry, 'key'>
>

const renderLicenseItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<LicenseEntry, ExtraData>) => {
	const expanded = extraData?.selectedKey === item.key
	const description = [
		item.type ?? 'Unknown license',
		item.version ? `v${item.version}` : undefined,
		item.dependencyType,
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<View>
			<List.Item
				title={item.name}
				description={description}
				left={(props) => (
					<List.Icon
						{...props}
						icon='package-variant'
					/>
				)}
				right={(props) => (
					<List.Icon
						{...props}
						icon={expanded ? 'chevron-up' : 'chevron-down'}
					/>
				)}
				onPress={() => extraData?.onPress(item.key)}
			/>
			{expanded && (
				<View style={styles.licenseDetail}>
					{item.url && (
						<Text
							variant='bodySmall'
							style={{ color: extraData?.onSurfaceVariant }}
						>
							{item.url}
						</Text>
					)}
					<Text
						variant='bodySmall'
						numberOfLines={12}
						style={styles.licenseText}
					>
						{item.content ?? '该依赖没有提供可展示的许可证正文。'}
					</Text>
				</View>
			)}
			<Divider />
		</View>
	)
}

export default function OpenSourceLicensesPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const [selectedKey, setSelectedKey] = useState<string | null>(null)

	const [searchQuery, setSearchQuery] = useState('')
	const [filteredQuery, setFilteredQuery] = useState('')
	const [startSearch, setStartSearch] = useState(false)
	const [isPending, startTransition] = useTransition()
	const searchbarHeight = useSharedValue(0)

	useEffect(() => {
		searchbarHeight.set(
			withTiming(startSearch ? SEARCHBAR_HEIGHT : 0, { duration: 180 }),
		)
	}, [searchbarHeight, startSearch])

	usePreventRemove(startSearch, () => {
		if (startSearch) {
			setStartSearch(false)
			setSearchQuery('')
			setFilteredQuery('')
		}
	})

	const handleSearchChange = (text: string) => {
		setSearchQuery(text)
		startTransition(() => {
			setFilteredQuery(text)
		})
	}

	const handleToggleSearch = () => {
		setStartSearch((prev) => {
			const next = !prev
			if (!next) {
				setSearchQuery('')
				setFilteredQuery('')
			}
			return next
		})
	}

	const licenses = useMemo(
		() =>
			Object.entries(rawLicenses)
				.map(([key, item]) => ({
					key,
					...item,
				}))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[],
	)

	const filteredLicenses = useMemo(() => {
		if (!filteredQuery.trim()) {
			return licenses
		}
		const lowerQuery = filteredQuery.toLowerCase()
		return licenses.filter(
			(license) =>
				license.name.toLowerCase().includes(lowerQuery) ||
				license.key.toLowerCase().includes(lowerQuery) ||
				(license.type && license.type.toLowerCase().includes(lowerQuery)) ||
				(license.content && license.content.toLowerCase().includes(lowerQuery)),
		)
	}, [licenses, filteredQuery])

	const extraData = useMemo<ExtraData>(
		() => ({
			selectedKey,
			onPress: (key) =>
				setSelectedKey((current) => (current === key ? null : key)),
			onSurfaceVariant: colors.onSurfaceVariant,
		}),
		[colors.onSurfaceVariant, selectedKey],
	)

	const searchbarAnimatedStyle = useAnimatedStyle(() => ({
		height: searchbarHeight.value,
	}))

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title='开源许可证'
					subtitle={`${filteredLicenses.length} 个依赖`}
				/>
				<Appbar.Action
					icon={startSearch ? 'close' : 'magnify'}
					onPress={handleToggleSearch}
				/>
			</Appbar.Header>

			{/* 搜索框 */}
			<Animated.View
				style={[styles.searchbarContainer, searchbarAnimatedStyle]}
			>
				<SearchBar
					placeholder='搜索依赖'
					onChangeText={handleSearchChange}
					value={searchQuery}
					loading={isPending}
				/>
			</Animated.View>

			<FlashList
				data={filteredLicenses}
				renderItem={renderLicenseItem}
				keyExtractor={(item) => item.key}
				extraData={extraData}
				contentContainerStyle={{
					paddingBottom: insets.bottom + (haveTrack ? 90 : 24),
				}}
			/>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	searchbarContainer: {
		overflow: 'hidden',
	},
	licenseDetail: {
		gap: 8,
		paddingHorizontal: 72,
		paddingBottom: 14,
	},
	licenseText: {
		lineHeight: 18,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
