import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

import { DataMigration } from './state'

const logger = log.extend('migrateIndependentAccountReset')

const migration = new DataMigration(
	'independent_account_v1',
	'independent_account_migrated_v1',
)

/** 将旧共享歌单账号状态清空，迁移到独立账号体系。 */
export function migrateIndependentAccountReset(): void {
	if (migration.isApplied()) return

	try {
		expoDb.withTransactionSync(() => {
			expoDb.runSync(
				`UPDATE playlists
				 SET share_id = NULL,
					 share_role = NULL,
					 last_share_sync_at = NULL
				 WHERE share_id IS NOT NULL
					OR share_role IS NOT NULL
					OR last_share_sync_at IS NOT NULL`,
			)
			expoDb.runSync(`DELETE FROM playlist_sync_queue`)
			migration.markAsApplied()
		})

		storage.remove('shared-playlist-members')
		storage.remove('bbplayer_jwt')
		logger.info('database.account_reset.completed')
	} catch (error) {
		logger.error('database.account_reset.failed', {}, error)
	}
}
