import {
	Orpheus,
	PlaybackState,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useLayoutEffect, useRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import {
	Directions,
	useTapGesture,
	useFlingGesture,
	useCompetingGestures,
	GestureDetector,
	Touchable,
} from 'react-native-gesture-handler'
import { Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import { useBottomTabBarHeight } from '@/hooks/router/useBottomTabBarHeight'
import useAppStore from '@/hooks/stores/useAppStore'
import * as Haptics from '@/utils/haptics'
import { resolveTrackCover } from '@/utils/imageUrl'

import ActivityIndicator from './common/ActivityIndicator'

const ProgressBar = memo(function ProgressBar() {
	const { position: sharedProgress, duration: sharedDuration } =
		useSmoothProgress(false)
	const sharedTrackViewWidth = useSharedValue(0)
	const trackViewRef = useRef<View>(null)
	const { colors } = useTheme()

	const animatedStyle = useAnimatedStyle(() => {
		const progressRatio = Math.min(
			sharedProgress.value / Math.max(sharedDuration.value, 1),
			1,
		)
		// 靠 transform 实现滑动效果，避免掉 reflow
		return {
			transform: [
				{
					translateX: (progressRatio - 1) * sharedTrackViewWidth.value,
				},
			],
		}
	})

	useLayoutEffect(() => {
		trackViewRef.current?.measure((_x, _y, width) => {
			sharedTrackViewWidth.value = width
		})
	}, [sharedTrackViewWidth, trackViewRef])

	return (
		<View style={styles.progressBarContainer}>
			<View
				ref={trackViewRef}
				style={[
					styles.progressBarTrack,
					// { backgroundColor: colors.outlineVariant },
				]}
			>
				<Animated.View
					style={[
						animatedStyle,
						styles.progressBarIndicator,
						{ backgroundColor: colors.primary },
					]}
				/>
			</View>
		</View>
	)
})

const NowPlayingBar = memo(function NowPlayingBar({
	backgroundColor,
}: {
	backgroundColor?: string
}) {
	const { colors } = useTheme()
	const isPlaying = useIsPlaying()
	const state = usePlaybackState()
	const currentTrack = useCurrentTrack()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const isVisible = currentTrack !== null
	const bottomBarHeight = useBottomTabBarHeight()

	const nowPlayingBarStyle = useAppStore(
		(state) => state.settings.nowPlayingBarStyle,
	)

	const finalPlayingIndicator = isPlaying ? 'pause' : 'play'

	const playPause = async () => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		const isPlaying = await Orpheus.getIsPlaying()
		if (isPlaying) {
			void Orpheus.pause()
		} else {
			await Orpheus.pause()
			await Orpheus.play()
		}
	}

	const navigateOnPlayerUpFling = useFlingGesture({
		direction: Directions.UP,
		onActivate: () => {
			scheduleOnRN(router.navigate, '/player')
		},
	})

	const preFling = useFlingGesture({
		direction: Directions.LEFT,
		onActivate: () => {
			scheduleOnRN(() => Orpheus.skipToPrevious())
		},
	})

	const nextFling = useFlingGesture({
		direction: Directions.RIGHT,
		onActivate: () => {
			scheduleOnRN(() => Orpheus.skipToNext())
		},
	})

	const outerTap = useTapGesture({
		onDeactivate: (e) => {
			if (!e.canceled) {
				scheduleOnRN(router.navigate, '/player')
			}
		},
	})

	const combinedGesture = useCompetingGestures(
		navigateOnPlayerUpFling,
		preFling,
		nextFling,
		outerTap,
	)

	const playerStyle =
		nowPlayingBarStyle === 'bottom'
			? [styles.nowPlayingBarBottom]
			: [styles.nowPlayingBarFloat]

	let bottomMargin = 0
	let bottomPadding = 0
	if (Platform.OS === 'ios') {
		if (bottomBarHeight === 0) {
			bottomMargin = insets.bottom + 10
		} else {
			bottomMargin = 10 + bottomBarHeight
		}
	} else {
		if (nowPlayingBarStyle === 'bottom') {
			if (bottomBarHeight > 0) {
				// 这样就是正常的，但是为什么是 20？？？？？？？？
				bottomMargin = 20
				bottomPadding = 0
			} else {
				// No tabs: extend background into system nav area
				bottomMargin = 0
				bottomPadding = insets.bottom
			}
		} else {
			bottomMargin = insets.bottom + 10
		}
	}

	return (
		<View
			pointerEvents='box-none'
			style={styles.nowPlayingBarContainer}
		>
			{isVisible && (
				<GestureDetector gesture={combinedGesture}>
					<View
						style={[
							playerStyle,
							{
								backgroundColor: backgroundColor ?? colors.elevation.level2,
								marginBottom: bottomMargin,
								paddingBottom: bottomPadding,
								height:
									nowPlayingBarStyle === 'bottom'
										? 70 + bottomPadding
										: undefined,
							},
						]}
						testID='now-playing-bar'
					>
						<View style={styles.nowPlayingBarContent}>
							<Image
								source={{
									uri:
										resolveTrackCover(
											currentTrack.uniqueKey,
											currentTrack.coverUrl,
										) ?? undefined,
								}}
								style={[
									styles.nowPlayingBarImage,
									{
										borderColor: colors.primary,
										borderRadius: nowPlayingBarStyle === 'bottom' ? 12 : 24,
									},
								]}
								recyclingKey={currentTrack.uniqueKey}
								cachePolicy={'disk'}
							/>

							<View style={styles.nowPlayingBarTextContainer}>
								<Text
									variant='titleSmall'
									numberOfLines={1}
									style={{ color: colors.onSurface }}
								>
									{currentTrack.title ?? '未知曲目'}
								</Text>
								<Text
									variant='bodySmall'
									numberOfLines={1}
									style={{ color: colors.onSurfaceVariant }}
								>
									{currentTrack.artist?.name ?? '未知'}
								</Text>
							</View>

							<View style={styles.nowPlayingBarControls}>
								<Touchable
									style={styles.nowPlayingBarControlButton}
									onPress={() => playPause()}
								>
									{state === PlaybackState.BUFFERING ? (
										<ActivityIndicator size='small' />
									) : (
										<Icon
											source={finalPlayingIndicator}
											size={24}
											color={colors.onSurface}
										/>
									)}
								</Touchable>

								<Touchable
									style={styles.nowPlayingBarControlButton}
									onPress={() =>
										TrueSheet.present('playerQueueModal').catch(() => {
											// Ignore error if view not found or already dismissed
										})
									}
								>
									<Icon
										source='format-list-bulleted'
										size={20}
										color={colors.onSurface}
									/>
								</Touchable>
							</View>
						</View>
						<View
							style={[
								styles.nowPlayingBarProgressContainer,
								nowPlayingBarStyle === 'bottom'
									? { left: 0, right: 0 }
									: { width: '88%', left: 26, right: 0 },
							]}
						>
							<ProgressBar />
						</View>
					</View>
				</GestureDetector>
			)}
		</View>
	)
})

const styles = StyleSheet.create({
	progressBarContainer: {
		width: '100%',
	},
	progressBarTrack: {
		height: 2,
		overflow: 'hidden',
		position: 'relative',
	},
	progressBarIndicator: {
		height: 2,
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		right: 0,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
	},
	nowPlayingBarBottom: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		position: 'relative',
		height: 70,
	},
	nowPlayingBarFloat: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 24,
		marginHorizontal: 20,
		position: 'relative',
		height: 48,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 3,
		},
		shadowOpacity: 0.29,
		shadowRadius: 4.65,
		elevation: 7,
	},
	nowPlayingBarContent: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	nowPlayingBarImage: {
		height: 48,
		width: 48,
		borderWidth: 1,
		zIndex: 2,
	},
	nowPlayingBarTextContainer: {
		marginLeft: 12,
		flex: 1,
		justifyContent: 'center',
		marginRight: 8,
	},
	nowPlayingBarControls: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 4,
	},
	nowPlayingBarControlButton: {
		borderRadius: 99999,
		padding: 10,
	},
	nowPlayingBarProgressContainer: {
		alignSelf: 'center',
		position: 'absolute',
		bottom: 0,
		zIndex: 1,
	},
})

NowPlayingBar.displayName = 'NowPlayingBar'

export default NowPlayingBar
