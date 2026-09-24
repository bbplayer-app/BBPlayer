import { bilibiliApi as bilibiliApiInstance } from '@/lib/api/bilibili/api'
import defaultDb from '@/lib/db/db'
import { artistService as artistServiceInstance } from '@/lib/services/artistService'
import { playlistService as playlistServiceInstance } from '@/lib/services/playlistService'
import { trackService as trackServiceInstance } from '@/lib/services/trackService'

import { SyncBilibiliPlaylistFacade } from './facade'

export { SyncBilibiliPlaylistFacade } from './facade'
export type { PlaylistSyncProgress } from './types'

export const syncFacade = new SyncBilibiliPlaylistFacade(
	trackServiceInstance,
	bilibiliApiInstance,
	playlistServiceInstance,
	artistServiceInstance,
	defaultDb,
)
