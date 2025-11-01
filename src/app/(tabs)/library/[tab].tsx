import NowPlayingBar from '@/components/NowPlayingBar'
import CollectionListComponent from '@/features/library/collection/CollectionList'
import FavoriteFolderListComponent from '@/features/library/favorite/FavoriteFolderList'
import LocalPlaylistListComponent from '@/features/library/local/LocalPlaylistList'
import MultiPageVideosListComponent from '@/features/library/multipage/MultiPageVideosList'
import type { BottomTabParamList } from '@/types/navigation'
import Icon from '@react-native-vector-icons/material-design-icons'
import { useState } from 'react'
import { Dimensions, View } from 'react-native'
import { IconButton, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SceneMap, TabBar, TabView } from 'react-native-tab-view'

const renderScene = SceneMap({
	local: LocalPlaylistListComponent,
	favorite: FavoriteFolderListComponent,
	collection: CollectionListComponent,
	multiPage: MultiPageVideosListComponent,
})

const routes = [
	{ key: 'local', title: '播放列表' },
	{ key: 'favorite', title: '收藏夹' },
	{ key: 'collection', title: '合集' },
	{ key: 'multiPage', title: '分 p' },
]

export enum Tabs {
	Local = 0,
	Favorite = 1,
	Collection = 2,
	MultiPage = 3,
}

export default function Library() {
	const [index, setIndex] = useState(Tabs.Local)
	const insets = useSafeAreaInsets()
	const colors = useTheme().colors
	const router = useRouter()
	const { tab } = useLocalSearchParams<{ tab: string }>()

	useFocusEffect(() => {
		if (tab === undefined) return
		setIndex(tab)
	})

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background,
			}}
		>
			<View
				style={{
					paddingBottom: 8,
					flex: 1,
					paddingTop: insets.top + 8,
				}}
			>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						marginHorizontal: 16,
						justifyContent: 'space-between',
					}}
				>
					<Text
						variant='headlineSmall'
						style={{ fontWeight: 'bold' }}
					>
						音乐库
					</Text>
					<View style={{ flexDirection: 'row' }}>
						<IconButton
							icon='progress-download'
							onPress={() => router.push('download')}
						/>
						<IconButton
							icon='trophy'
							onPress={() => router.push('leaderboard')}
						/>
					</View>
				</View>
				<TabView
					style={{ flex: 1, backgroundColor: colors.background }}
					navigationState={{ index, routes }}
					renderScene={renderScene}
					overScrollMode={'never'}
					renderTabBar={(props) => (
						<TabBar
							{...props}
							style={{
								backgroundColor: colors.background,
								overflow: 'hidden',
								justifyContent: 'center',
								maxHeight: 70,
								marginBottom: 20,
								marginTop: 20,
								elevation: 0,
							}}
							indicatorStyle={{ backgroundColor: colors.onSecondaryContainer }}
							activeColor={colors.onSecondaryContainer}
							inactiveColor={colors.onSurface}
						/>
					)}
					onIndexChange={setIndex}
					initialLayout={{ width: Dimensions.get('window').width, height: 0 }}
					options={{
						favorite: {
							icon: ({ focused }) => (
								<Icon
									name={
										focused ? 'star-box-multiple' : 'star-box-multiple-outline'
									}
									size={20}
									color={
										focused ? colors.onSecondaryContainer : colors.onSurface
									}
								/>
							),
						},
						collection: {
							icon: ({ focused }) => (
								<Icon
									name={focused ? 'folder' : 'folder-outline'}
									size={20}
									color={
										focused ? colors.onSecondaryContainer : colors.onSurface
									}
								/>
							),
						},
						multiPage: {
							icon: ({ focused }) => (
								<Icon
									name={focused ? 'folder-play' : 'folder-play-outline'}
									size={20}
									color={
										focused ? colors.onSecondaryContainer : colors.onSurface
									}
								/>
							),
						},
						local: {
							icon: ({ focused }) => (
								<Icon
									name={focused ? 'list-box' : 'list-box-outline'}
									size={20}
									color={
										focused ? colors.onSecondaryContainer : colors.onSurface
									}
								/>
							),
						},
					}}
				/>
			</View>
			<View
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
				}}
			>
				<NowPlayingBar />
			</View>
		</View>
	)
}
