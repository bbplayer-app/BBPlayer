import { useIsPlaying, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import { Computed } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import {
	Pressable,
	StyleSheet,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Text, TouchableRipple, useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import SkinThumbUpBurst from '@/features/player/components/visuals/SkinThumbUpBurst'
import { SpectrumVisualizer } from '@/features/player/components/visuals/SpectrumVisualizer'
import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import {
	SQUIRCLE_RADIUS_RATIO,
	SQUIRCLE_CORNER_SMOOTHING,
} from '@/theme/dimensions'
import { getGradientColors } from '@/utils/color'

export function TrackInfo({
	onArtistPress,
	onPressCover,
	coverRef,
}: {
	onArtistPress: () => void
	onPressCover?: () => void
	coverRef: ImageRef | null
}) {
	const { colors } = useTheme()
	const [coverArea, setCoverArea] = useState({ width: 0, height: 0 })

	const colorScheme = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'

	const currentTrack = useCurrentTrack()
	const isPlaying = useIsPlaying()
	const [isTitleExpanded, setIsTitleExpanded] = useState(false)
	const [thumbUpBurstSignal, setThumbUpBurstSignal] = useState(0)
	const activeSkin = useActiveSkin()
	const pureWhiteBackground = useAppStore((s) => s.settings.pureWhiteBackground)

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
		<View style={styles.container}>
			<Computed>
				{() => {
					const podcast = playbackContextStore$.context.mode.get() === 'podcast'
					// Reserve space for the spectrum outside the circle as well as cover padding.
					const coverPadding = !podcast && enableSpectrumVisualizer ? 80 : 24

					const coverSize = Math.max(
						0,
						Math.min(
							coverArea.width - (podcast ? 80 : 120),
							coverArea.height - coverPadding,
							480,
						),
					)

					const showCover = !podcast || coverSize >= 96

					const coverBorderRadius = podcast
						? coverSize * SQUIRCLE_RADIUS_RATIO
						: coverSize / 2

					return (
						<Pressable
							style={[
								styles.coverContainer,
								// Keep the original cover block height on roomy screens; shrink on small ones.
								{ maxHeight: Math.max(0, coverArea.width - 32) },
							]}
							onLayout={({ nativeEvent }) => setCoverArea(nativeEvent.layout)}
							onPress={onPressCover}
						>
							{!pureWhiteBackground &&
								!podcast &&
								enableSpectrumVisualizer &&
								coverSize > 0 && (
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
							{showCover && (
								<TouchableOpacity
									activeOpacity={0.8}
									onPress={onPressCover}
									disabled={!onPressCover}
									accessibilityRole={onPressCover ? 'button' : 'image'}
									accessibilityLabel={
										onPressCover
											? podcast
												? '查看字幕'
												: '查看歌词'
											: '歌曲封面'
									}
									style={{ width: coverSize, height: coverSize }}
									testID='player-cover'
								>
									<SquircleView
										style={{
											width: coverSize,
											height: coverSize,
											borderRadius: coverBorderRadius,
											overflow: 'hidden',
										}}
										cornerSmoothing={SQUIRCLE_CORNER_SMOOTHING}
									>
										{pureWhiteBackground ? (
											<View
												style={[
													styles.coverGradient,
													{ backgroundColor: colors.background },
												]}
												testID='player-cover-placeholder'
											>
												<Text>
													{onPressCover
														? podcast
															? '查看字幕'
															: '查看歌词'
														: '歌曲封面'}
												</Text>
											</View>
										) : !coverRef ? (
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
														{ fontSize: Math.max(1, coverSize * 0.45) },
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
									</SquircleView>
								</TouchableOpacity>
							)}
						</Pressable>
					)
				}}
			</Computed>

			<View style={styles.trackInfoContainer}>
				<View style={styles.trackTitleContainer}>
					<View style={styles.trackTitleTextContainer}>
						<TouchableRipple
							onPress={() => setIsTitleExpanded((expanded) => !expanded)}
						>
							<Text
								variant='titleLarge'
								style={styles.trackTitle}
								numberOfLines={isTitleExpanded ? 3 : 1}
								ellipsizeMode='tail'
							>
								{currentTrack.title}
							</Text>
						</TouchableRipple>
						{currentTrack.artist?.name && (
							<TouchableRipple
								testID='player-artist'
								onPress={onArtistPress}
							>
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
								testID='player-thumb-up'
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
	container: {
		flex: 1,
		minHeight: 0,
		// 封面被 maxHeight 限制时，把封面与标题整体居中，而不是在标题下方留出大片空白。
		justifyContent: 'center',
	},
	coverContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
		minHeight: 0,
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
		flexShrink: 0,
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
