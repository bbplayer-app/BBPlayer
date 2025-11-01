import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import { PlayerControls } from '@/features/player/components/PlayerControls'
import { PlayerFunctionalMenu } from '@/features/player/components/PlayerFunctionalMenu'
import { PlayerHeader } from '@/features/player/components/PlayerHeader'
import Lyrics from '@/features/player/components/PlayerLyrics'
import { PlayerSlider } from '@/features/player/components/PlayerSlider'
import { TrackInfo } from '@/features/player/components/PlayerTrackInfo'
import useCurrentTrack from '@/hooks/stores/playerHooks/useCurrentTrack'
import * as Haptics from '@/utils/haptics'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useImage } from 'expo-image'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Dimensions, View } from 'react-native'
import { IconButton, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function PlayerPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const { width: screenWidth } = Dimensions.get('window')
	const sheetRef = useRef<BottomSheetMethods>(null)

	const currentTrack = useCurrentTrack()

	const [viewMode, setViewMode] = useState<'cover' | 'lyrics'>('cover')
	const [menuVisible, setMenuVisible] = useState(false)

	const coverRef = useImage(currentTrack?.coverUrl ?? '')

	if (!currentTrack) {
		return (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.background,
				}}
			>
				<Text style={{ color: colors.onBackground }}>没有正在播放的曲目</Text>
				<IconButton
					icon='arrow-left'
					onPress={() => router.back()}
				/>
			</View>
		)
	}

	return (
		<View
			style={{
				flex: 1,
				height: '100%',
				width: '100%',
				backgroundColor: colors.background,
				paddingTop: insets.top,
			}}
		>
			<View style={{ flex: 1, justifyContent: 'space-between' }}>
				<View
					style={{
						flex: 1,
						marginBottom: 16,
						pointerEvents: menuVisible ? 'none' : 'auto',
					}}
				>
					<PlayerHeader
						onMorePress={() => setMenuVisible(true)}
						viewMode={viewMode}
						trackTitle={currentTrack.title}
					/>
					{viewMode === 'cover' ? (
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
								setViewMode('lyrics')
							}}
							coverRef={coverRef}
						/>
					) : (
						<Lyrics
							onBackPress={() => setViewMode('cover')}
							track={currentTrack}
						/>
					)}
				</View>

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

			<PlayerFunctionalMenu
				menuVisible={menuVisible}
				setMenuVisible={setMenuVisible}
				screenWidth={screenWidth}
				uploaderMid={Number(currentTrack.artist?.remoteId ?? undefined)}
				track={currentTrack}
			/>

			<PlayerQueueModal sheetRef={sheetRef} />
		</View>
	)
}
