import PlayerQueueModal from '@/components/modals/PlayerQueueModal'
import { PlayerFunctionalMenu } from '@/features/player/components/PlayerFunctionalMenu'
import { PlayerHeader } from '@/features/player/components/PlayerHeader'
import Lyrics from '@/features/player/components/PlayerLyrics'
import PlayerMainTab from '@/features/player/components/PlayerMainTab'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { useMemo, useRef, useState } from 'react'
import { Dimensions, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabView } from 'react-native-tab-view'

const routes = [
	{ key: 'main', title: 'Main' },
	{ key: 'lyrics', title: 'Lyrics' },
]

const screenWidth = Dimensions.get('window').width

export default function PlayerPage() {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const sheetRef = useRef<BottomSheetMethods>(null)

	const [index, setIndex] = useState(0)
	const [menuVisible, setMenuVisible] = useState(false)

	const renderScene = useMemo(
		() =>
			// eslint-disable-next-line react/display-name
			({
				route,
				jumpTo,
			}: {
				route: { key: string; title: string }
				jumpTo: (key: string) => void
			}) => {
				switch (route.key) {
					case 'main':
						return (
							<PlayerMainTab
								sheetRef={sheetRef}
								jumpTo={jumpTo}
							/>
						)
					case 'lyrics':
						return <Lyrics />
				}
			},
		[sheetRef],
	)

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
			<View
				style={{
					flex: 1,
					marginBottom: 16,
					pointerEvents: menuVisible ? 'none' : 'auto',
				}}
			>
				<PlayerHeader
					onMorePress={() => setMenuVisible(true)}
					index={index}
				/>
				<TabView
					style={{ flex: 1 }}
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={setIndex}
					initialLayout={{ width: screenWidth }}
					lazy={({ route }) => route.key === 'lyrics'}
					renderTabBar={() => null}
				/>
			</View>

			<PlayerFunctionalMenu
				menuVisible={menuVisible}
				setMenuVisible={setMenuVisible}
			/>

			<PlayerQueueModal sheetRef={sheetRef} />
		</View>
	)
}
