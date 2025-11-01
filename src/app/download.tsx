import NowPlayingBar from '@/components/NowPlayingBar'
import DownloadHeader from '@/features/downloads/DownloadHeader'
import DownloadTaskItem from '@/features/downloads/DownloadTaskItem'
import useDownloadManagerStore from '@/hooks/stores/useDownloadManagerStore'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import type { DownloadTask } from '@/types/core/downloadManagerStore'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { View } from 'react-native'
import { Appbar, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/shallow'

export default function DownloadPage() {
	const { colors } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const tasks = useDownloadManagerStore(
		useShallow((state) => Object.values(state.downloads)),
	)
	const start = useDownloadManagerStore((state) => state.startDownload)
	const clearAll = useDownloadManagerStore((state) => state.clearAll)

	const haveTrack = usePlayerStore((state) => !!state.currentTrackUniqueKey)

	const renderItem = useCallback(({ item }: { item: DownloadTask }) => {
		return <DownloadTaskItem task={item} />
	}, [])

	const keyExtractor = useCallback((item: DownloadTask) => item.uniqueKey, [])

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='下载任务' />
			</Appbar.Header>

			<DownloadHeader
				taskCount={tasks.length}
				onStartAll={start}
				onClearAll={clearAll}
			/>

			<View style={{ flex: 1 }}>
				<FlashList
					data={tasks}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					contentContainerStyle={{
						paddingBottom: haveTrack ? 70 + insets.bottom : insets.bottom,
					}}
				/>
			</View>
			<View
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
				}}
			>
				<NowPlayingBar />
			</View>
		</View>
	)
}
