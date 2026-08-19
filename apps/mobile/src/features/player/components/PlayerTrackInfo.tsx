import { useIsPlaying, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import type { ColorSchemeName } from 'react-native'
import {
	Dimensions,
	Pressable,
	StyleSheet,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native'
import { Text, TouchableRipple, useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { getGradientColors } from '@/utils/color'

import SkinThumbUpBurst from './SkinThumbUpBurst'
import { SpectrumVisualizer } from './SpectrumVisualizer'

const { width: screenWidth } = Dimensions.get('window')

const COVER_SIZE = screenWidth - 120

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
	const colorScheme: ColorSchemeName = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'

	const currentTrack = useCurrentTrack()
	const isPlaying = useIsPlaying()
	const [isTitleExpanded, setIsTitleExpanded] = useState(false)
	const [thumbUpBurstSignal, setThumbUpBurstSignal] = useState(0)
	const activeSkin = useActiveSkin()

	const enableSpectrumVisualizer = useSpectrumVisualizerEnabled()

	const { data: isThumbUp, isPending: isThumbUpPending } = useGetVideoIsThumbUp(
		currentTrack?.source === 'bilibili'
			? currentTrack?.bilibiliMetadata.bvid
			: undefined,
	)
	const { mutate: doThumbUpAction } = useThumbUpVideo()

	const isBilibiliVideo = currentTrack?.source === 'bilibili'

	const { color1, color2 } = getGradientColors(
		currentTrack?.title ?? '',
		isDark,
	)

	const firstChar =
		currentTrack &&
		(currentTrack.title.length > 0
			? currentTrack?.title.charAt(0).toUpperCase()
			: undefined)

	const coverSize = COVER_SIZE
	const coverBorderRadius = coverSize / 2

	const onThumbUpPress = () => {
		if (isThumbUpPending || !isBilibiliVideo || !currentTrack) return
		if (!isThumbUp) {
			setThumbUpBurstSignal((signal) => signal + 1)
		}
		doThumbUpAction({
			bvid: currentTrack.bilibiliMetadata.bvid,
			like: !isThumbUp,
		})
	}

	useEffect(() => {
		setIsTitleExpanded(false)
	}, [currentTrack?.uniqueKey])

	if (!currentTrack) return null

	return (
		<View
			style={{
				position: 'relative',
			}}
		>
			<Pressable
				style={styles.coverContainer}
				onPress={onPressCover}
			>
				{enableSpectrumVisualizer && (
					<View
						style={[
							StyleSheet.absoluteFill,
							{ alignItems: 'center', justifyContent: 'center' },
						]}
					>
						<SpectrumVisualizer
							isPlaying={isPlaying}
							size={coverSize}
							color={colors.primary}
						/>
					</View>
				)}
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={onPressCover}
					style={{ width: coverSize, height: coverSize }}
					testID='player-cover'
				>
					{!coverRef ? (
						<LinearGradient
							colors={[color1, color2]}
							style={[
								styles.coverGradient,
								{ borderRadius: coverBorderRadius },
							]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
						>
							<Text
								style={[
									styles.coverPlaceholderText,
									{ fontSize: coverSize * 0.45 },
								]}
							>
								{firstChar}
							</Text>
						</LinearGradient>
					) : (
						<Image
							source={coverRef}
							style={{
								width: coverSize,
								height: coverSize,
								borderRadius: coverBorderRadius,
							}}
							recyclingKey={currentTrack.uniqueKey}
							cachePolicy={'disk'}
							transition={300}
						/>
					)}
				</TouchableOpacity>
			</Pressable>

			<View style={styles.trackInfoContainer}>
				<View style={styles.trackTitleContainer}>
					<View style={styles.trackTitleTextContainer}>
						<TouchableRipple
							onPress={() => setIsTitleExpanded((expanded) => !expanded)}
						>
							<Text
								variant='titleLarge'
								style={styles.trackTitle}
								numberOfLines={isTitleExpanded ? undefined : 1}
								ellipsizeMode='tail'
							>
								{currentTrack.title}
							</Text>
						</TouchableRipple>
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
						<View style={styles.thumbUpButtonContainer}>
							<SkinThumbUpBurst
								skin={activeSkin}
								playSignal={thumbUpBurstSignal}
							/>
							<IconButton
								icon={isThumbUp ? 'heart' : 'heart-outline'}
								size={24}
								iconColor={isThumbUp ? colors.error : colors.onSurfaceVariant}
								onPress={onThumbUpPress}
							/>
						</View>
					)}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	coverContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		height: COVER_SIZE + 48,
		paddingHorizontal: 32,
	},
	coverGradient: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	coverPlaceholderText: {
		fontWeight: 'bold',
		color: 'rgba(255, 255, 255, 0.7)',
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
	thumbUpButtonContainer: {
		position: 'relative',
	},
})
