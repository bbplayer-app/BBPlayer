import { useIsPlaying } from '@bbplayer/orpheus'
import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import type { ColorSchemeName } from 'react-native'
import {
	Dimensions,
	Pressable,
	StyleSheet,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper'

import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import useAppStore from '@/hooks/stores/useAppStore'
import { getGradientColors } from '@/utils/color'

import { DanmakuView } from './danmaku/DanmakuView'
import { SpectrumVisualizer } from './SpectrumVisualizer'

const { width: screenWidth } = Dimensions.get('window')

const COVER_SIZE_RECT = screenWidth - 80
const COVER_SIZE_CIRCLE = screenWidth - 120

export function TrackInfo({
	onArtistPress,
	onPressCover,
	coverRef,
	danmakuEnabled,
}: {
	onArtistPress: () => void
	onPressCover: () => void
	coverRef: ImageRef | null
	danmakuEnabled: boolean
}) {
	const { colors } = useTheme()
	const colorScheme: ColorSchemeName = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'
	const [size, setSize] = useState({ width: 0, height: 0 })
	const enableDanmaku = useAppStore((state) => state.settings.enableDanmaku)

	const currentTrack = useCurrentTrack()
	const isPlaying = useIsPlaying()

	const enableSpectrumVisualizer = useAppStore(
		(state) => state.settings.enableSpectrumVisualizer,
	)

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

	const coverSize = enableSpectrumVisualizer
		? COVER_SIZE_CIRCLE
		: COVER_SIZE_RECT
	const coverBorderRadius = enableSpectrumVisualizer
		? coverSize / 2
		: COVER_SIZE_RECT * 0.22

	const onThumbUpPress = () => {
		if (isThumbUpPending || !isBilibiliVideo || !currentTrack) return
		doThumbUpAction({
			bvid: currentTrack.bilibiliMetadata.bvid,
			like: !isThumbUp,
		})
	}

	if (!currentTrack) return null

	return (
		<View
			onLayout={(e) => {
				const { width, height } = e.nativeEvent.layout
				setSize({ width, height })
			}}
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
						enableSpectrumVisualizer ? (
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
							<SquircleView
								style={[
									styles.coverGradient,
									{ borderRadius: coverBorderRadius, overflow: 'hidden' },
								]}
								cornerSmoothing={0.6}
							>
								<LinearGradient
									colors={[color1, color2]}
									style={StyleSheet.absoluteFill}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
								/>
								<Text
									style={[
										styles.coverPlaceholderText,
										{ fontSize: coverSize * 0.45 },
									]}
								>
									{firstChar}
								</Text>
							</SquircleView>
						)
					) : enableSpectrumVisualizer ? (
						<Image
							source={coverRef}
							style={{
								width: coverSize,
								height: coverSize,
								borderRadius: coverBorderRadius,
								zIndex: -1,
							}}
							recyclingKey={currentTrack.uniqueKey}
							cachePolicy={'none'}
							transition={300}
						/>
					) : (
						<SquircleView
							style={{
								width: coverSize,
								height: coverSize,
								borderRadius: coverBorderRadius,
								overflow: 'hidden',
							}}
							cornerSmoothing={0.6}
						>
							<Image
								source={coverRef}
								style={{
									width: coverSize,
									height: coverSize,
								}}
								recyclingKey={currentTrack.uniqueKey}
								cachePolicy={'none'}
								transition={300}
							/>
						</SquircleView>
					)}
				</TouchableOpacity>
				{currentTrack.source === 'bilibili' &&
					enableDanmaku &&
					size.width > 0 &&
					size.height > 0 && (
						<DanmakuView
							bvid={currentTrack.bilibiliMetadata.bvid}
							cid={currentTrack.bilibiliMetadata.cid ?? undefined}
							width={size.width}
							height={COVER_SIZE_RECT + 48}
							enable={danmakuEnabled}
						/>
					)}
			</Pressable>

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
		justifyContent: 'center',
		height: COVER_SIZE_RECT + 48,
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
})
