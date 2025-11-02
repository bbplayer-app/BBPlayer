import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
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

	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'space-between',
				paddingHorizontal: 16,
				paddingVertical: 8,
			}}
		>
			<IconButton
				icon='chevron-down'
				size={24}
				onPress={() => router.back()}
			/>
			<Text
				variant='titleMedium'
				style={{
					flex: 1,
					textAlign: 'center',
				}}
				numberOfLines={1}
			>
				{index === 1
					? (currentTrack?.title ?? '正在播放')
					: currentTrack?.trackDownloads?.status === 'downloaded'
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
