import { Show, useValue } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { isCompactSize, MAX_WIDTH } from '@/hooks/ui/useResponsiveLayout'
import * as Haptics from '@/utils/haptics'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	/** 宽屏双栏播放器：歌词常驻右栏，评论以侧边面板展示。 */
	embedded?: boolean
	onPresent: () => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	onPresent,
	embedded = false,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const mode = useValue(playbackContextStore$.context.mode)
	const [size, setSize] = useState({ width: 0, height: 0 })

	// 按播放区域自身的尺寸判断，双栏时左栏比整个页面窄。
	const compact = isCompactSize({
		width: size.width,
		height: size.height - insets.bottom,
	})

	if (!currentTrack) return null

	return (
		<Show if={playbackContextStore$.ready}>
			<View
				style={styles.container}
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
					{mode === 'podcast' && !embedded && (
						<Button
							testID='player-open-subtitles'
							icon='subtitles-outline'
							onPress={() => jumpTo('lyrics')}
							compact
						>
							字幕
						</Button>
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
			</View>
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
})

PlayerMainTab.displayName = 'PlayerMainTab'

export default PlayerMainTab
