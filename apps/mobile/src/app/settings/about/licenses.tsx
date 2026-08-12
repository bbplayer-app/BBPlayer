import { LegendList } from '@legendapp/list/react-native'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { StyleSheet, View } from 'react-native'
import type { Library } from 'react-native-legal'
import { ReactNativeLegal } from 'react-native-legal'
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
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'

type ExtraData = {
	selectedKey: string | null
	onPress: (id: string) => void
	onSurfaceVariant: string
}

const SEARCHBAR_HEIGHT = 72

const renderLicenseItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<Library, ExtraData>) => {
	const expanded = extraData?.selectedKey === item.id
	const license = item.licenses[0]
	const description = [
		license?.name ?? 'Unknown license',
		item.version ? `v${item.version}` : undefined,
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
				onPress={() => extraData?.onPress(item.id)}
			/>
			{expanded && (
				<View style={styles.licenseDetail}>
					{license?.url && (
						<Text
							variant='bodySmall'
							style={{ color: extraData?.onSurfaceVariant }}
						>
							{license.url}
						</Text>
					)}
					<Text
						variant='bodySmall'
						numberOfLines={12}
						style={styles.licenseText}
					>
						{license?.licenseContent ?? '该依赖没有提供可展示的许可证正文。'}
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

	const [libraries, setLibraries] = useState<Library[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		void ReactNativeLegal.getLibrariesAsync().then((result) => {
			setLibraries(
				result.data.slice().sort((a, b) => a.name.localeCompare(b.name)),
			)
			setLoading(false)
		})
	}, [])

	const filteredLicenses = useMemo(() => {
		if (!filteredQuery.trim()) {
			return libraries
		}
		const lowerQuery = filteredQuery.toLowerCase()
		return libraries.filter(
			(lib) =>
				lib.name.toLowerCase().includes(lowerQuery) ||
				lib.id.toLowerCase().includes(lowerQuery) ||
				lib.licenses[0]?.name?.toLowerCase().includes(lowerQuery) ||
				lib.licenses[0]?.licenseContent?.toLowerCase().includes(lowerQuery),
		)
	}, [libraries, filteredQuery])

	const extraData = useMemo<ExtraData>(
		() => ({
			selectedKey,
			onPress: (id) =>
				setSelectedKey((current) => (current === id ? null : id)),
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
					subtitle={loading ? '加载中...' : `${filteredLicenses.length} 个依赖`}
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

			<LegendList
				data={filteredLicenses}
				renderItem={renderLicenseItem}
				keyExtractor={(item) => item.id}
				extraData={extraData}
				recycleItems
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
