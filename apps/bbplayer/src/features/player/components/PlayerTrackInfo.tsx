import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { ColorSchemeName } from 'react-native'
import {
	Dimensions,
	StyleSheet,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native'
import { IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper'

import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import { getGradientColors } from '@/utils/color'

const { width: screenWidth } = Dimensions.get('window')
const coverSize = screenWidth - 80

export function TrackInfo({
	onArtistPress,
	onPressCover,
	coverRef,
}: {
	onArtistPress: () => void
	onPressCover: () => void
	coverRef: ImageRef | null
}) {
	const { colors } = useTheme()
	const currentTrack = useCurrentTrack()
	const isBilibiliVideo = currentTrack?.source === 'bilibili'
	const colorScheme: ColorSchemeName = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'

	const { color1, color2 } = getGradientColors(
		currentTrack?.title ?? '',
		isDark,
	)

	const firstChar =
		currentTrack &&
		(currentTrack.title.length > 0
			? currentTrack?.title.charAt(0).toUpperCase()
			: undefined)

	const { data: isThumbUp, isPending: isThumbUpPending } = useGetVideoIsThumbUp(
		isBilibiliVideo ? currentTrack?.bilibiliMetadata.bvid : undefined,
	)
	const { mutate: doThumbUpAction } = useThumbUpVideo()

	const onThumbUpPress = () => {
		if (isThumbUpPending || !isBilibiliVideo) return
		doThumbUpAction({
			bvid: currentTrack.bilibiliMetadata.bvid,
			like: !isThumbUp,
		})
	}

	if (!currentTrack) return null

	return (
		<View>
			<View style={styles.coverContainer}>
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={onPressCover}
					style={styles.coverTouchable}
				>
					{!coverRef ? (
						<LinearGradient
							colors={[color1, color2]}
							style={styles.coverGradient}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
						>
							<Text style={styles.coverPlaceholderText}>{firstChar}</Text>
						</LinearGradient>
					) : (
						<Image
							source={coverRef}
							style={styles.coverImage}
							recyclingKey={currentTrack.uniqueKey}
							cachePolicy={'none'}
							transition={300}
						/>
					)}
				</TouchableOpacity>
			</View>

			<View style={styles.trackInfoContainer}>
				<View style={styles.trackTitleContainer}>
					<View style={styles.trackTitleTextContainer}>
						<Text
							variant='titleLarge'
							style={styles.trackTitle}
							numberOfLines={4}
						>
							{currentTrack.title}
						</Text>
						{currentTrack.artist?.name && (
							<TouchableRipple onPress={onArtistPress}>
								<Text
									variant='bodyMedium'
									style={{ color: colors.onSurfaceVariant }}
									numberOfLines={1}
								>
									{currentTrack.artist.name}
								</Text>
							</TouchableRipple>
						)}
					</View>
					{isBilibiliVideo && (
						<IconButton
							icon={isThumbUp ? 'heart' : 'heart-outline'}
							size={24}
							iconColor={isThumbUp ? colors.error : colors.onSurfaceVariant}
							onPress={onThumbUpPress}
						/>
					)}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	coverContainer: {
		alignItems: 'center',
		paddingHorizontal: 32,
		paddingVertical: 24,
	},
	coverTouchable: {
		width: coverSize,
		height: coverSize,
	},
	coverGradient: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: 16,
	},
	coverPlaceholderText: {
		fontSize: coverSize * 0.45,
		fontWeight: 'bold',
		color: 'rgba(255, 255, 255, 0.7)',
	},
	coverImage: {
		width: coverSize,
		height: coverSize,
		borderRadius: 16,
	},
	trackInfoContainer: {
		paddingHorizontal: 24,
	},
	trackTitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	trackTitleTextContainer: {
		flex: 1,
		marginRight: 8,
	},
	trackTitle: {
		fontWeight: 'bold',
	},
})
