import useCurrentTrack from '@/hooks/stores/playerHooks/useCurrentTrack'
import { View } from 'react-native'
import { IconButton, Text } from 'react-native-paper'

export function PlayerHeader({
	onMorePress,
	viewMode,
	trackTitle,
}: {
	onMorePress: () => void
	viewMode: 'lyrics' | 'cover'
	trackTitle?: string
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
				{viewMode === 'lyrics'
					? (trackTitle ?? '正在播放')
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
