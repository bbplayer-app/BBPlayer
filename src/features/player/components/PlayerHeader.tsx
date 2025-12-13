import { useBatchDownloadStatus } from '@/hooks/player/useBatchDownloadStatus'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { DownloadState } from '@roitium/expo-orpheus'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { IconButton, Text } from 'react-native-paper'

export function PlayerHeader({
	onMorePress,
	index,
}: {
	onMorePress: () => void
	index: number
}) {
	const router = useRouter()
	const currentTrack = useCurrentTrack()
	const { data: downloadStatus } = useBatchDownloadStatus(
		currentTrack?.uniqueKey ? [currentTrack.uniqueKey] : [],
	)

	return (
		<View style={styles.container}>
			{
				<IconButton
					icon={index === 0 ? 'chevron-down' : 'chevron-left'}
					size={24}
					onPress={() => router.back()}
				/>
			}
			<Text
				variant='titleMedium'
				style={styles.title}
				numberOfLines={1}
			>
				{index === 1
					? (currentTrack?.title ?? '正在播放')
					: downloadStatus?.[currentTrack?.uniqueKey ?? ''] ===
						  DownloadState.COMPLETED
						? '正在播放 (已缓存)'
						: '正在播放'}
			</Text>
			<IconButton
				icon='dots-vertical'
				size={24}
				onPress={onMorePress}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	title: {
		flex: 1,
		textAlign: 'center',
	},
})
