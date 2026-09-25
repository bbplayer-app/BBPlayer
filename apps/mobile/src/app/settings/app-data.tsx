import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Appbar, Divider, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useStorageDirectory } from '@/hooks/queries/native/storage'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import { formatBytes } from '@/utils/format'

interface Row {
	isDirectory: boolean
	key: string
	name: string
	parent: boolean
	path: string
	sizeBytes: number
}

export default function AppPrivateDataPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const isReady = useScreenTransitionReady()
	const [path, setPath] = useState('')

	// 等屏幕过渡动画结束后再开始遍历私有目录。
	const {
		data: entries,
		isPending,
		isError,
	} = useStorageDirectory(path, isReady)

	const goToParent = useCallback(() => {
		setPath((prev) =>
			prev.includes('/') ? prev.slice(0, prev.lastIndexOf('/')) : '',
		)
	}, [])

	// 页面内返回优先回到上一级目录，只有已在根目录时才退出页面。
	usePreventRemove(path !== '', goToParent)

	const handleBack = () => {
		if (path) {
			goToParent()
		} else {
			router.back()
		}
	}

	const rows = useMemo<Row[]>(() => {
		const list: Row[] = []
		if (path) {
			list.push({
				key: '..',
				name: '上级目录',
				parent: true,
				path: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
				isDirectory: true,
				sizeBytes: 0,
			})
		}
		for (const entry of entries ?? []) {
			list.push({
				key: entry.path,
				name: entry.name,
				parent: false,
				path: entry.path,
				isDirectory: entry.isDirectory,
				sizeBytes: entry.sizeBytes,
			})
		}
		return list
	}, [entries, path])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={handleBack} />
				<Appbar.Content title='应用私有目录' />
			</Appbar.Header>
			<View style={styles.header}>
				<Text
					variant='titleSmall'
					numberOfLines={2}
					style={{ color: colors.onSurface }}
				>
					{path ? `/${path}` : '/'}
				</Text>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					只读 · 应用私有目录
				</Text>
			</View>
			<FlatList
				style={styles.list}
				data={rows}
				keyExtractor={(item) => item.key}
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 20) },
				]}
				ItemSeparatorComponent={() => <Divider style={styles.divider} />}
				renderItem={({ item }) => (
					<List.Item
						title={item.name}
						left={(props) => (
							<List.Icon
								{...props}
								icon={
									item.parent
										? 'arrow-up-left'
										: item.isDirectory
											? 'folder'
											: 'file-outline'
								}
							/>
						)}
						right={() => (
							<View style={styles.rowEnd}>
								{!item.isDirectory && (
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										{formatBytes(item.sizeBytes)}
									</Text>
								)}
								{item.isDirectory && (
									<List.Icon
										icon='chevron-right'
										color={colors.onSurfaceVariant}
									/>
								)}
							</View>
						)}
						onPress={item.isDirectory ? () => setPath(item.path) : undefined}
					/>
				)}
				ListEmptyComponent={
					isPending ? null : (
						<View style={styles.empty}>
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								{isError ? '读取失败' : '此目录为空'}
							</Text>
						</View>
					)
				}
				ListFooterComponent={
					isPending ? (
						<View style={styles.empty}>
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								计算中...
							</Text>
						</View>
					) : null
				}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	list: { flex: 1 },
	content: { paddingHorizontal: 16 },
	header: { gap: 2, paddingHorizontal: 24, paddingVertical: 12 },
	divider: { marginVertical: 2 },
	rowEnd: { alignItems: 'center', flexDirection: 'row', gap: 4 },
	empty: { alignItems: 'center', paddingVertical: 48 },
})
