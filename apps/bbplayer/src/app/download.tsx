import type { DownloadTask } from '@roitium/expo-orpheus'
import { Orpheus } from '@roitium/expo-orpheus'
import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Appbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import NowPlayingBar from '@/components/NowPlayingBar'
import DownloadHeader from '@/features/downloads/DownloadHeader'
import DownloadTaskItem from '@/features/downloads/DownloadTaskItem'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { queryClient } from '@/lib/config/queryClient'

const renderItem = ({ item }: { item: DownloadTask }) => {
	return <DownloadTaskItem initTask={item} />
}

export default function DownloadPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const {
		data: tasks,
		isPending,
		isError,
		error,
	} = useQuery({
		queryKey: ['downloadTasks'],
		queryFn: async () => {
			return await Orpheus.getUncompletedDownloadTasks()
		},
		staleTime: 0,
	})

	const haveTrack = useCurrentTrack()

	const header = (
		<Appbar.Header elevated>
			<Appbar.BackAction onPress={() => router.back()} />
			<Appbar.Content title='下载任务' />
		</Appbar.Header>
	)

	const keyExtractor = useCallback((item: DownloadTask) => item.id, [])

	if (isPending) {
		return (
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				{header}
				<ActivityIndicator
					size='large'
					color={colors.primary}
					style={{ flex: 1 }}
				/>
			</View>
		)
	}

	if (isError) {
		return (
			<View style={[styles.container, { backgroundColor: colors.background }]}>
				{header}
				<Text
					variant='bodyMedium'
					style={{ color: colors.error, padding: 16 }}
				>
					加载下载任务失败: {error.message}
				</Text>
			</View>
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			{header}

			<DownloadHeader
				taskCount={tasks.length}
				onClearAll={async () => {
					await Orpheus.clearUncompletedDownloadTasks()
					await queryClient.invalidateQueries({ queryKey: ['downloadTasks'] })
				}}
			/>

			<View style={styles.listContainer}>
				<FlashList
					data={tasks}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					contentContainerStyle={{
						paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
					}}
				/>
			</View>
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
	listContainer: {
		flex: 1,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
