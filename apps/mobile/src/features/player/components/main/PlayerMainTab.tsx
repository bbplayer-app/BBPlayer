import { Show, useValue } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import {
	PlayerControls,
	type PlayerSidePane,
} from '@/features/player/components/controls/PlayerControls'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	embedded?: boolean
	onOpenComments?: () => void
	/** 宽屏双栏时在右栏打开队列；不传则打开底部弹层。 */
	onOpenQueue?: () => void
	activePane?: PlayerSidePane
	onPresent: () => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	onPresent,
	onOpenComments,
	onOpenQueue,
	activePane = null,
	embedded = false,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const mode = useValue(playbackContextStore$.context.mode)
	const [size, setSize] = useState({ width: 0, height: 0 })
	const compact = size.height - insets.bottom < 600 || size.width < 360

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
						onOpenComments={onOpenComments}
						activePane={activePane}
						compact={compact}
						onOpenQueue={
							onOpenQueue ??
							(() => {
								onPresent()
								void usePlayerQueueSheetStore.getState().open()
							})
						}
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
		maxWidth: 600,
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
