import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'

import { PlayerControls } from './PlayerControls'
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

	if (!currentTrack) return null
	return (
		<ScrollView
			contentContainerStyle={styles.container}
			showsVerticalScrollIndicator={false}
		>
			<TrackInfo
				onArtistPress={() =>
					currentTrack.artist?.remoteId
						? router.push({
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
					{ paddingBottom: Math.max(insets.bottom + 20, 20) },
					styles.controlsContainer,
				]}
			>
				<PlayerSlider />
				<PlayerControls
					onOpenQueue={() => {
						onPresent()
						void usePlayerQueueSheetStore.getState().open()
					}}
				/>
			</View>
		</ScrollView>
	)
})

const styles = StyleSheet.create({
	container: {
		flexGrow: 1,
		justifyContent: 'space-between',
	},
	controlsContainer: {
		paddingHorizontal: 24,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
