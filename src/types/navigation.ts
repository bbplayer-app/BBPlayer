import type { AlertModalProps } from '@/components/modals/AlertModal'
import type { Playlist, Track } from '@/types/core/media'
import type { ParsedLrc } from '@/types/player/lyrics'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'

export interface ModalPropsMap {
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
export interface ModalInstance<K extends ModalKey = ModalKey> {
	key: K
	props: ModalPropsMap[K]
	options?: { dismissible?: boolean } // default: true
}
