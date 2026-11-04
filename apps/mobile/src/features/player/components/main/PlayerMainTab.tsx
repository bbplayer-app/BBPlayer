import { Show } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	onPresent: () => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	onPresent,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
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
					onPressCover={() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						jumpTo('lyrics')
					}}
					coverRef={imageRef}
				/>

				<View
					style={[
						{ paddingBottom: insets.bottom + (compact ? 8 : 20) },
						styles.controlsContainer,
					]}
				>
					<PlayerSlider />
					<PlayerControls
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
	},
	controlsContainer: {
		flexShrink: 0,
		paddingTop: 8,
		paddingHorizontal: 24,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
