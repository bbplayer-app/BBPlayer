import { Show, useValue } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	FadeIn,
	FadeOut,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { isCompactSize, MAX_WIDTH } from '@/hooks/ui/useResponsiveLayout'
import * as Haptics from '@/utils/haptics'
import { storage } from '@/utils/mmkv'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	/** 宽屏双栏播放器：歌词常驻右栏，评论以侧边面板展示。 */
	embedded?: boolean
	onPresent: () => void
}

const SUBTITLES_HINT_DELAY = 600
const SUBTITLES_HINT_DURATION = 3500

/**
 * 首次进入播客模式时提示一次字幕页的位置：页面向左轻推两下再复位，并显示一行文字。
 * 用户可能在播放器内直接切换模式，所以以模式切换（而非页面进场）为触发时机。
 */
function usePodcastSubtitlesHint(enabled: boolean) {
	const translateX = useSharedValue(0)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		if (!enabled || storage.getBoolean('podcast_subtitles_hint_shown')) return

		const showTimer = setTimeout(() => {
			storage.set('podcast_subtitles_hint_shown', true)
			setVisible(true)

			const easing = Easing.out(Easing.cubic)
			translateX.set(
				withSequence(
					withTiming(-40, { duration: 260, easing }),
					withTiming(0, { duration: 260, easing }),
					withDelay(120, withTiming(-24, { duration: 220, easing })),
					withTiming(0, { duration: 220, easing }),
				),
			)
		}, SUBTITLES_HINT_DELAY)

		const hideTimer = setTimeout(
			() => setVisible(false),
			SUBTITLES_HINT_DELAY + SUBTITLES_HINT_DURATION,
		)

		return () => {
			clearTimeout(showTimer)
			clearTimeout(hideTimer)
		}
	}, [enabled, translateX])

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.get() }],
	}))

	return { visible, animatedStyle }
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	onPresent,
	embedded = false,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const currentTrack = useCurrentTrack()
	const mode = useValue(playbackContextStore$.context.mode)

	const subtitlesHint = usePodcastSubtitlesHint(
		mode === 'podcast' && !embedded && !!currentTrack,
	)

	const [size, setSize] = useState({ width: 0, height: 0 })

	// 按播放区域自身的尺寸判断，双栏时左栏比整个页面窄。
	const compact = isCompactSize({
		width: size.width,
		height: size.height - insets.bottom,
	})

	if (!currentTrack) return null

	return (
		<Show if={playbackContextStore$.ready}>
			<Animated.View
				style={[styles.container, subtitlesHint.animatedStyle]}
				onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
			>
				<TrackInfo
					onArtistPress={() =>
						currentTrack.artist?.remoteId
							? router.navigate({
									pathname: '/playlist/remote/uploader/[mid]',
									params: { mid: currentTrack.artist?.remoteId },
								})
							: void 0
					}
					onPressCover={
						embedded
							? undefined
							: () => {
									void Haptics.performHaptics(
										Haptics.AndroidHaptics.Context_Click,
									)
									jumpTo('lyrics')
								}
					}
					coverRef={imageRef}
				/>

				<View
					style={[
						{ paddingBottom: insets.bottom + (compact ? 8 : 20) },
						styles.controlsContainer,
					]}
				>
					{subtitlesHint.visible && (
						<Animated.View
							entering={FadeIn}
							exiting={FadeOut}
							pointerEvents='none'
							style={[
								styles.subtitlesHint,
								{ backgroundColor: colors.inverseSurface },
							]}
							testID='player-subtitles-hint'
						>
							<Text
								variant='labelLarge'
								style={{ color: colors.inverseOnSurface }}
							>
								左滑或点击封面查看字幕
							</Text>
						</Animated.View>
					)}
					<PlayerSlider />
					<PlayerControls
						commentsPane={embedded}
						compact={compact}
						onOpenQueue={() => {
							onPresent()
							void usePlayerQueueSheetStore.getState().open()
						}}
					/>
				</View>
			</Animated.View>
		</Show>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		minHeight: 0,
		// 平板竖屏下保持播放区域的阅读宽度，避免控件散布到屏幕两端。
		width: '100%',
		maxWidth: MAX_WIDTH.player,
		alignSelf: 'center',
	},
	controlsContainer: {
		flexShrink: 0,
		paddingTop: 8,
		paddingHorizontal: 24,
	},
	// 悬浮在控件区上方，出现和消失都不挤动布局。
	subtitlesHint: {
		position: 'absolute',
		bottom: '100%',
		alignSelf: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 999,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'

export default PlayerMainTab
