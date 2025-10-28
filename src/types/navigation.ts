/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* react-navigation 指明了 RootStackParamList 必须使用 type alias */
import type { Tabs } from '@/app/(tabs)/library/[tab]'
import type { AlertModalProps } from '@/components/modals/AlertModal'
import type { Playlist, Track } from '@/types/core/media'
import type { ParsedLrc } from '@/types/player/lyrics'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'
import type { NavigatorScreenParams } from '@react-navigation/native'

export type BottomTabParamList = {
	Home: undefined
	Library: { tab: Tabs } | undefined
	Settings: undefined
}

export type RootStackParamList = {
	MainTabs: NavigatorScreenParams<BottomTabParamList>
	Player: undefined
	Test: undefined
	SearchResult: { query: string }
	NotFound: undefined
	PlaylistCollection: { id: string }
	PlaylistFavorite: { id: string }
	PlaylistMultipage: { bvid: string }
	PlaylistUploader: { mid: string }
	PlaylistLocal: { id: string }
	SearchResultFav: { query: string }
	LeaderBoard: undefined
	ModalHost: undefined
	Download: undefined
}

export type ModalPropsMap = {
	AddVideoToBilibiliFavorite: { bvid: string }
	EditPlaylistMetadata: { playlist: Playlist }
	EditTrackMetadata: { track: Track }
	QRCodeLogin: undefined
	CookieLogin: undefined
	CreatePlaylist: { redirectToNewPlaylist?: boolean }
	UpdateApp: { version: string; notes: string; url: string; forced?: boolean }
	UpdateTrackLocalPlaylists: { track: Track }
	Welcome: undefined
	BatchAddTracksToLocalPlaylist: {
		payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[]
	}
	DuplicateLocalPlaylist: { sourcePlaylistId: number; rawName: string }
	ManualSearchLyrics: { uniqueKey: string; initialQuery: string }
	Alert: AlertModalProps
	EditLyrics: { uniqueKey: string; lyrics: ParsedLrc }
	SleepTimer: undefined
}

export type ModalKey = keyof ModalPropsMap
export type ModalInstance<K extends ModalKey = ModalKey> = {
	key: K
	props: ModalPropsMap[K]
	options?: { dismissible?: boolean } // default: true
}
