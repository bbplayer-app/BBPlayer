import type { AlertModalProps } from '@/components/modals/AlertModal'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import type { Playlist, Track } from '@/types/core/media'
import type { GenericTrack } from '@/types/external_playlist'
import type { LyricFileData } from '@/types/player/lyrics'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'

export interface ModalPropsMap {
	ManualMatchExternalSync: {
		track: GenericTrack
		initialQuery: string
		onMatch: (result: MatchResult) => void
	}
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
	InputExternalPlaylistInfo: undefined
	Alert: AlertModalProps
	EditLyrics: { uniqueKey: string; lyrics: LyricFileData }
	SleepTimer: undefined
	SaveQueueToPlaylist: { trackIds: string[] }
	DonationQR: { type: 'wechat' }
	PlaybackSpeed: undefined
	LyricsSelection: undefined
	SongShare: undefined
	SyncLocalToBilibili: { playlistId: number }
	FavoriteSyncProgress: {
		favoriteId: number
		shouldRedirectToLocalPlaylist?: boolean
	}
	DanmakuSettings: undefined
	CoverDownloadProgress: undefined
	ExportDownloadsProgress: {
		ids: string[]
		destinationUri: string
	}
	EnableSharing: {
		playlistId: number
		shareId?: string | null
		shareRole?: 'owner' | 'editor' | 'subscriber' | null
	}
	SubscribeToSharedPlaylist: undefined
}

export type ModalKey = keyof ModalPropsMap
export interface ModalInstance<K extends ModalKey = ModalKey> {
	key: K
	props: ModalPropsMap[K]
	options?: { dismissible?: boolean } // default: true
}
