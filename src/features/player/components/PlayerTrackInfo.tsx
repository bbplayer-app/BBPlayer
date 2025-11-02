import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import { getGradientColors } from '@/utils/color'
import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { ColorSchemeName } from 'react-native'
import {
	Dimensions,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native'
import { IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper'

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
	const { width: screenWidth } = Dimensions.get('window')
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
			<View
				style={{
					alignItems: 'center',
					paddingHorizontal: 32,
					paddingVertical: 24,
				}}
			>
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={onPressCover}
					style={{
						width: screenWidth - 80,
						height: screenWidth - 80,
					}}
				>
					{!coverRef ? (
						<LinearGradient
							colors={[color1, color2]}
							style={{
								flex: 1,
								justifyContent: 'center',
								alignItems: 'center',
								borderRadius: 16,
							}}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
						>
							<Text
								style={{
									fontSize: (screenWidth - 80) * 0.45,
									fontWeight: 'bold',
									color: 'rgba(255, 255, 255, 0.7)',
								}}
							>
								{firstChar}
							</Text>
						</LinearGradient>
					) : (
						<Image
							source={coverRef}
							style={{
								width: screenWidth - 80,
								height: screenWidth - 80,
								borderRadius: 16,
							}}
							recyclingKey={currentTrack.uniqueKey}
							cachePolicy={'none'}
							transition={300}
						/>
					)}
				</TouchableOpacity>
			</View>

			<View style={{ paddingHorizontal: 24 }}>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<View style={{ flex: 1, marginRight: 8 }}>
						<Text
							variant='titleLarge'
							style={{ fontWeight: 'bold' }}
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
