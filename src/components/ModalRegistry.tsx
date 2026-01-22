import type { ModalKey, ModalPropsMap } from '@/types/navigation'
import type { ComponentType } from 'react'
import { lazy } from 'react'

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
const PlaybackSpeedModal = lazy(
	() => import('./modals/player/PlaybackSpeedModal'),
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
	Alert: AlertModal,
	EditLyrics: EditLyricsModal,
	SleepTimer: SleepTimerModal,
	DonationQR: DonationQRModal,
}
