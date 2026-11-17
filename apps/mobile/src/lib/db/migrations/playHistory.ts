import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'

import { DataMigration } from './state'

const logger = log.extend('migratePlayHistory')

const migration = new DataMigration(
	'play_history_v1',
	'play_history_migrated_v1',
)

/** 将 tracks 表中的 JSON 播放历史迁移到 play_history 表。 */
export function migratePlayHistory(): void {
	if (migration.isApplied()) return

	try {
		const tracksTableInfo = expoDb.getAllSync<{ name: string }>(
			`PRAGMA table_info(tracks)`,
		)

		const hasOldColumn = tracksTableInfo.some(
			(column) => column.name === 'play_history',
		)

		if (!hasOldColumn) {
			logger.info('database.play_history.skipped')
			migration.markAsApplied()

			return
		}

		const tableExists = expoDb.getFirstSync<{ name: string }>(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='play_history'`,
		)

		if (!tableExists) {
			logger.warning('database.play_history.table_missing')

			return
		}

		expoDb.withTransactionSync(() => {
			type Row = { id: number; play_history: string }

			const rows = expoDb.getAllSync<Row>(
				`SELECT id, play_history FROM tracks WHERE play_history IS NOT NULL AND play_history != '[]'`,
			)

			if (rows.length > 0) {
				for (const row of rows) {
					const history = JSON.parse(row.play_history)

					if (!Array.isArray(history)) continue

					for (const record of history) {
						expoDb.runSync(
							`INSERT INTO play_history (track_id, start_time, duration_played, completed, created_at)
							 VALUES (?, ?, ?, ?, (unixepoch() * 1000))`,
							[
								row.id,
								record.startTime,
								record.durationPlayed,
								record.completed ? 1 : 0,
							],
						)
					}
				}

				logger.info('database.play_history.migrated', {
					'database.track_count': rows.length,
				})
			}

			migration.markAsApplied()
		})
	} catch (error) {
		logger.error('database.play_history.failed', {}, error)
	}
}
