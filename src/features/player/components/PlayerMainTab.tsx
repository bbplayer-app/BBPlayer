import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import * as Haptics from '@/utils/haptics'
import type BottomSheet from '@gorhom/bottom-sheet'
import { useImage } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, type RefObject } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlayerControls } from './PlayerControls'
import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	sheetRef: RefObject<BottomSheet | null>
	jumpTo: (key: string) => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	sheetRef,
	jumpTo,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const coverRef = useImage(currentTrack?.coverUrl ?? '')

	if (!currentTrack) return null
	return (
		<View style={{ flex: 1, justifyContent: 'space-between' }}>
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
					void Haptics.performAndroidHapticsAsync(
						Haptics.AndroidHaptics.Context_Click,
					)
					jumpTo('lyrics')
				}}
				coverRef={coverRef}
			/>

			<View
				style={{
					paddingHorizontal: 24,
					paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
				}}
			>
				<PlayerSlider />
				<PlayerControls
					onOpenQueue={() => sheetRef.current?.snapToPosition('75%')}
				/>
			</View>
		</View>
	)
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
