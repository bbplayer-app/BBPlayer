import { DownloadState } from '@bbplayer/orpheus'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import Animated, {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import IconButton from '@/components/common/IconButton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useBatchDownloadStatus } from '@/hooks/queries/orpheus'

export function PlayerHeader({
	onMorePress,
	onBack,
	index,
	scrollX,
}: {
	onMorePress: () => void
	onBack: () => void
	index: number
	scrollX?: SharedValue<number>
}) {
	const currentTrack = useCurrentTrack()
	const { data: downloadStatus } = useBatchDownloadStatus(
		currentTrack?.uniqueKey ? [currentTrack.uniqueKey] : [],
	)

	const title = currentTrack?.title ?? '正在播放'
	const statusText =
		downloadStatus?.[currentTrack?.uniqueKey ?? ''] === DownloadState.COMPLETED
			? '正在播放 (已缓存)'
			: '正在播放'

	const titleStyle = useAnimatedStyle(() => {
		if (!scrollX) return { opacity: index === 1 ? 1 : 0 }
		return {
			opacity: interpolate(
				scrollX.value,
				[0.4, 1],
				[0, 1],
				Extrapolation.CLAMP,
			),
		}
	})

	const statusStyle = useAnimatedStyle(() => {
		if (!scrollX) return { opacity: index === 0 ? 1 : 0 }
		return {
			opacity: interpolate(
				scrollX.value,
				[0, 0.4],
				[1, 0],
				Extrapolation.CLAMP,
			),
		}
	})

	return (
		<View style={styles.container}>
			{
				<IconButton
					icon={index === 0 ? 'chevron-down' : 'chevron-left'}
					size={24}
					onPress={onBack}
				/>
			}
			<View style={styles.titleContainer}>
				<Animated.View
					style={[styles.headerTextContainer, statusStyle]}
					pointerEvents='none'
				>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={styles.text}
					>
						{statusText}
					</Text>
				</Animated.View>
				<Animated.View
					style={[styles.headerTextContainer, titleStyle]}
					pointerEvents='none'
				>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={styles.text}
					>
						{title}
					</Text>
				</Animated.View>
			</View>
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
	titleContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		height: 40,
	},
	headerTextContainer: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		alignItems: 'center',
	},
	text: {
		textAlign: 'center',
	},
})
