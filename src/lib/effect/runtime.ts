import { DatabaseLive } from '@/lib/db/db'
import { BilibiliFacadeLive } from '@/lib/facades/bilibili'
import { PlaylistFacadeLive } from '@/lib/facades/playlist'
import { SyncFacadeLive } from '@/lib/facades/sync'
import { ArtistServiceLive } from '@/lib/services/artistService'
import { LyricServiceLive } from '@/lib/services/lyricService'
import { PlaylistServiceLive } from '@/lib/services/playlistService'
import { TrackServiceLive } from '@/lib/services/trackService'
import { Layer, ManagedRuntime } from 'effect'

const DBLayer = DatabaseLive

const TrackServiceLiveReady = TrackServiceLive.pipe(Layer.provide(DBLayer))
const ArtistServiceLiveReady = ArtistServiceLive.pipe(
	Layer.provide(DBLayer),
	Layer.provide(TrackServiceLiveReady),
)
const PlaylistServiceLiveReady = PlaylistServiceLive.pipe(
	Layer.provide(DBLayer),
	Layer.provide(TrackServiceLiveReady),
)
const LyricServiceLiveReady = LyricServiceLive

const ServicesLayer = Layer.mergeAll(
	ArtistServiceLiveReady,
	TrackServiceLiveReady,
	PlaylistServiceLiveReady,
	LyricServiceLiveReady,
)

const PlaylistFacadeLiveReady = PlaylistFacadeLive.pipe(
	Layer.provide(ServicesLayer),
	Layer.provide(DBLayer),
)
const SyncFacadeLiveReady = SyncFacadeLive.pipe(
	Layer.provide(ServicesLayer),
	Layer.provide(DBLayer),
)
const BilibiliFacadeLiveReady = BilibiliFacadeLive

const FacadesLayer = Layer.mergeAll(
	PlaylistFacadeLiveReady,
	SyncFacadeLiveReady,
	BilibiliFacadeLiveReady,
)

const AppLive = Layer.mergeAll(FacadesLayer, DBLayer, ServicesLayer)

export const AppRuntime = ManagedRuntime.make(AppLive)
