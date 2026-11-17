import { LegendList } from '@legendapp/list/react-native'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Library } from 'react-native-legal'
import { Appbar, Divider, Searchbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useOpenSourceLibraries } from '@/hooks/queries/native/licenses'

// 列表里同时有 JS 包和原生库，自己的 workspace 包不算第三方组件
const isOwnPackage = (library: Library) => library.name.startsWith('@bbplayer/')

const licenseNames = (library: Library) =>
	library.licenses
		.map((license) => license.name)
		.filter(Boolean)
		.join(', ')

const Separator = () => <Divider />

function LibraryItem({
	library,
	expanded,
	onToggle,
}: {
	library: Library
	expanded: boolean
	onToggle: () => void
}) {
	const { colors } = useTheme()
	const license = licenseNames(library)
	const subtitle = [library.version, license].filter(Boolean).join(' · ')

	return (
		<Pressable
			onPress={onToggle}
			android_ripple={{ color: colors.surfaceVariant }}
			style={styles.item}
		>
			<Text variant='bodyLarge'>{library.name}</Text>
			{subtitle ? (
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					{subtitle}
				</Text>
			) : null}
			{expanded && library.description ? (
				<Text
					variant='bodyMedium'
					style={styles.description}
				>
					{library.description}
				</Text>
			) : null}
			{expanded &&
				library.licenses.map((item, index) => (
					<Text
						// 同一个库的许可证没有稳定 id，顺序也不会变
						// oxlint-disable-next-line react/no-array-index-key
						key={index}
						variant='bodySmall'
						selectable
						style={[styles.licenseText, { color: colors.onSurfaceVariant }]}
					>
						{item.licenseContent || item.url || '没有附带许可证全文'}
					</Text>
				))}
		</Pressable>
	)
}

export default function OpenSourceLicensesPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const { data, isPending, isError } = useOpenSourceLibraries()
	const [query, setQuery] = useState('')
	const [expandedId, setExpandedId] = useState<string | null>(null)

	const libraries = useMemo(() => {
		const keyword = query.trim().toLowerCase()

		return (
			(data ?? [])
				.filter((library) => !isOwnPackage(library))
				// 原生库的显示名和 Maven 坐标差别很大（如 Media3 ExoPlayer module），两者都能搜
				.filter(
					(library) =>
						!keyword ||
						library.name.toLowerCase().includes(keyword) ||
						library.id.toLowerCase().includes(keyword),
				)
				.sort((a, b) => a.name.localeCompare(b.name))
		)
	}, [data, query])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='第三方组件许可' />
			</Appbar.Header>
			<Searchbar
				placeholder='搜索组件'
				value={query}
				onChangeText={setQuery}
				style={styles.search}
			/>
			{isPending ? (
				<ActivityIndicator style={styles.status} />
			) : (
				<LegendList
					data={libraries}
					keyExtractor={(item) => item.id}
					extraData={expandedId}
					ItemSeparatorComponent={Separator}
					ListEmptyComponent={
						<Text
							variant='bodyLarge'
							style={styles.status}
						>
							{isError ? '读取组件列表失败' : '没有找到组件'}
						</Text>
					}
					contentContainerStyle={{
						paddingBottom: insets.bottom + (haveTrack ? 90 : 24),
					}}
					renderItem={({ item }) => (
						<LibraryItem
							library={item}
							expanded={expandedId === item.id}
							onToggle={() =>
								setExpandedId((current) =>
									current === item.id ? null : item.id,
								)
							}
						/>
					)}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	search: {
		marginHorizontal: 16,
		marginBottom: 8,
	},
	description: {
		marginTop: 8,
	},
	item: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	licenseText: {
		marginTop: 12,
		fontFamily: 'monospace',
	},
	status: {
		marginTop: 32,
		alignSelf: 'center',
	},
})
