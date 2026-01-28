import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import * as Haptics from '@/utils/haptics'
import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, type RefObject } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlayerControls } from './PlayerControls'
import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	sheetRef: RefObject<TrueSheet | null>
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	onPresent: () => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	sheetRef,
	jumpTo,
	imageRef,
	onPresent,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()

	if (!currentTrack) return null
	return (
		<View style={styles.container}>
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
					{ paddingBottom: insets.bottom > 0 ? insets.bottom : 20 },
					styles.controlsContainer,
				]}
			>
				<PlayerSlider />
				<PlayerControls
					onOpenQueue={() => {
						onPresent()
						sheetRef.current?.present().catch(() => {
							// Ignore error
						})
					}}
				/>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'space-between',
	},
	controlsContainer: {
		paddingHorizontal: 24,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
