import DownloadPage from '@/app/download'
import LeaderBoardPage from '@/app/leaderboard'
import NotFoundScreen from '@/app/not-found'
import PlayerPage from '@/app/player/player'
import LocalPlaylistPage from '@/app/playlist/local/[id]'
import PlaylistCollectionPage from '@/app/playlist/remote/collection/[id]'
import PlaylistFavoritePage from '@/app/playlist/remote/favorite/[id]'
import PlaylistMultipagePage from '@/app/playlist/remote/multipage/[bvid]'
import SearchResultFavPage from '@/app/playlist/remote/search-result/fav/[query]'
import SearchResultsPage from '@/app/playlist/remote/search-result/global/[query]'
import PlaylistUploaderPage from '@/app/playlist/remote/uploader/[mid]'
import TabLayout from '@/app/tabs/layout'
import TestPage from '@/app/test/test'
import ModalHost from '@/components/ModalHost'
import type { RootStackParamList } from '@/types/navigation'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View } from 'react-native'

export const RootStack = createNativeStackNavigator<RootStackParamList>()

export function RootLayoutNav() {
	return (
		<View style={{ flex: 1 }}>
			<RootStack.Navigator
				initialRouteName='MainTabs'
				screenOptions={{ headerShown: false }}
			>
				<RootStack.Screen
					name='MainTabs'
					component={TabLayout}
				/>
				<RootStack.Screen
					name='Player'
					component={PlayerPage}
					options={{
						animation: 'slide_from_bottom',
					}}
				/>
				<RootStack.Screen
					name='Test'
					component={TestPage}
				/>
				<RootStack.Screen
					name='SearchResult'
					component={SearchResultsPage}
				/>
				<RootStack.Screen
					name='PlaylistCollection'
					component={PlaylistCollectionPage}
				/>
				<RootStack.Screen
					name='PlaylistFavorite'
					component={PlaylistFavoritePage}
				/>
				<RootStack.Screen
					name='PlaylistMultipage'
					component={PlaylistMultipagePage}
				/>
				<RootStack.Screen
					name='PlaylistUploader'
					component={PlaylistUploaderPage}
				/>
				<RootStack.Screen
					name='SearchResultFav'
					component={SearchResultFavPage}
				/>
				<RootStack.Screen
					name='PlaylistLocal'
					component={LocalPlaylistPage}
				/>
				<RootStack.Screen
					name='LeaderBoard'
					component={LeaderBoardPage}
				/>
				<RootStack.Screen
					name='Download'
					component={DownloadPage}
				/>
				<RootStack.Screen
					name='NotFound'
					component={NotFoundScreen}
				/>
				<RootStack.Screen
					name='ModalHost'
					component={ModalHost}
					options={{
						presentation: 'transparentModal',
						gestureEnabled: false,
						animation: 'fade',
					}}
				/>
			</RootStack.Navigator>
		</View>
	)
}
