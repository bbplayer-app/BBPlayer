import type { ComponentType } from 'react'
import { lazy } from 'react'

import type { ModalKey, ModalPropsMap } from '@/types/navigation'

const AlertModal = lazy(() => import('./modals/AlertModal'))
const DonationQRModal = lazy(() => import('./modals/app/DonationQRModal'))
const UpdateAppModal = lazy(() => import('./modals/app/UpdateAppModal'))
const WelcomeModal = lazy(() => import('./modals/app/WelcomeModal'))
const AddToFavoriteListsModal = lazy(
	() => import('./modals/bilibili/AddVideoToBilibiliFavModal'),
)
const EditPlaylistMetadataModal = lazy(
	() => import('./modals/edit-metadata/editPlaylistMetadataModal'),
)
const EditTrackMetadataModal = lazy(
	() => import('./modals/edit-metadata/editTrackMetadataModal'),
)
const CookieLoginModal = lazy(() => import('./modals/login/CookieLoginModal'))
const QrCodeLoginModal = lazy(() => import('./modals/login/QRCodeLoginModal'))
const EditLyricsModal = lazy(() => import('./modals/lyrics/EditLyrics'))
const ManualSearchLyricsModal = lazy(
	() => import('./modals/lyrics/ManualSearchLyrics'),
)
const SleepTimerModal = lazy(() => import('./modals/player/SleepTimerModal'))
const BatchAddTracksToLocalPlaylistModal = lazy(
	() => import('./modals/playlist/BatchAddTracksToLocalPlaylist'),
)
const CreatePlaylistModal = lazy(
	() => import('./modals/playlist/CreatePlaylistModal'),
)
const DuplicateLocalPlaylistModal = lazy(
	() => import('./modals/playlist/DuplicateLocalPlaylistModal'),
)
const UpdateTrackLocalPlaylistsModal = lazy(
	() => import('./modals/playlist/UpdateTrackLocalPlaylistsModal'),
)
const SaveQueueToPlaylistModal = lazy(
	() => import('./modals/playlist/SaveQueueToPlaylistModal'),
)
const PlaybackSpeedModal = lazy(
	() => import('./modals/player/PlaybackSpeedModal'),
)
const LyricsSelectionModal = lazy(
	() => import('./modals/player/LyricsSelectionModal'),
)
const SongShareModal = lazy(() => import('./modals/player/SongShareModal'))
const SyncLocalToBilibiliModal = lazy(
	() => import('./modals/playlist/SyncLocalToBilibiliModal'),
)
const FavoriteSyncProgressModal = lazy(
	() => import('./modals/playlist/FavoriteSyncProgressModal'),
)
const ManualMatchExternalSyncModal = lazy(
	() => import('./modals/playlist/ManualMatchExternalSync'),
)

const InputExternalPlaylistInfoModal = lazy(
	() => import('./modals/playlist/InputExternalPlaylistInfo'),
)
const DanmakuSettingsModal = lazy(
	() => import('./modals/player/DanmakuSettingsModal'),
)
const CoverDownloadProgressModal = lazy(
	() => import('./modals/settings/CoverDownloadProgressModal'),
)
const ExportDownloadsProgressModal = lazy(
	() => import('./modals/settings/ExportDownloadsProgressModal'),
)
const EnableSharingModal = lazy(
	() => import('./modals/playlist/EnableSharingModal'),
)
const SubscribeToSharedPlaylistModal = lazy(
	() => import('./modals/playlist/SubscribeToSharedPlaylistModal'),
)

type ModalComponent<K extends ModalKey> = ComponentType<ModalPropsMap[K] & {}>

export const modalRegistry: { [K in ModalKey]: ModalComponent<K> } = {
	PlaybackSpeed: PlaybackSpeedModal,
	AddVideoToBilibiliFavorite: AddToFavoriteListsModal,
	EditPlaylistMetadata: EditPlaylistMetadataModal,
	EditTrackMetadata: EditTrackMetadataModal,
	BatchAddTracksToLocalPlaylist: BatchAddTracksToLocalPlaylistModal,
	CookieLogin: CookieLoginModal,
	QRCodeLogin: QrCodeLoginModal,
	CreatePlaylist: CreatePlaylistModal,
	UpdateApp: UpdateAppModal,
	Welcome: WelcomeModal,
	UpdateTrackLocalPlaylists: UpdateTrackLocalPlaylistsModal,
	DuplicateLocalPlaylist: DuplicateLocalPlaylistModal,
	ManualSearchLyrics: ManualSearchLyricsModal,
	InputExternalPlaylistInfo: InputExternalPlaylistInfoModal,
	Alert: AlertModal,
	EditLyrics: EditLyricsModal,
	SleepTimer: SleepTimerModal,
	DonationQR: DonationQRModal,
	SaveQueueToPlaylist: SaveQueueToPlaylistModal,
	LyricsSelection: LyricsSelectionModal,
	SongShare: SongShareModal,
	SyncLocalToBilibili: SyncLocalToBilibiliModal,
	FavoriteSyncProgress: FavoriteSyncProgressModal,
	ManualMatchExternalSync: ManualMatchExternalSyncModal,
	DanmakuSettings: DanmakuSettingsModal,
	CoverDownloadProgress: CoverDownloadProgressModal,
	ExportDownloadsProgress: ExportDownloadsProgressModal,
	EnableSharing: EnableSharingModal,
	SubscribeToSharedPlaylist: SubscribeToSharedPlaylistModal,
}
