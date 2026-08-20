import { generateKeyBetween } from 'fractional-indexing'

import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'

import { DataMigration } from './state'

const logger = log.extend('migrateSortKeysV2')
const migration = new DataMigration('sort_key_v2', 'sort_key_migrated_v2') // gitleaks:allow

export function migrateSortKeysV2(): void {
	if (migration.isApplied()) return

	try {
		const tableInfo = expoDb.getAllSync<{ name: string }>(
			`PRAGMA table_info(playlist_tracks)`,
		)
		const hasOrderColumn = tableInfo.some((col) => col.name === 'order')

		if (!hasOrderColumn) {
			logger.info('[v2] 物理表中已无 order 字段，无需执行数据迁移与删除操作')
			migration.markAsApplied()
			return
		}

		expoDb.withTransactionSync(() => {
			type Row = { playlist_id: number; track_id: number }
			const rows = expoDb.getAllSync<Row>(
				`SELECT playlist_id, track_id
                 FROM playlist_tracks
                 WHERE sort_key = '' OR sort_key IS NULL
                 ORDER BY playlist_id ASC, "order" ASC, rowid ASC`,
			)

			if (rows.length > 0) {
				type MaxKeyRow = { playlist_id: number; max_key: string }
				const maxKeys = expoDb.getAllSync<MaxKeyRow>(
					`SELECT playlist_id, MAX(sort_key) as max_key
                     FROM playlist_tracks
                     WHERE sort_key != '' AND sort_key IS NOT NULL
                     GROUP BY playlist_id`,
				)

				const maxKeyMap = new Map<number, string>()
				for (const row of maxKeys) maxKeyMap.set(row.playlist_id, row.max_key)

				const grouped = new Map<number, number[]>()
				for (const row of rows) {
					const trackIds = grouped.get(row.playlist_id) ?? []
					trackIds.push(row.track_id)
					grouped.set(row.playlist_id, trackIds)
				}

				for (const [playlistId, trackIds] of grouped) {
					let previousKey: string | null = maxKeyMap.get(playlistId) || null
					for (const trackId of trackIds) {
						const sortKey = generateKeyBetween(previousKey, null)
						previousKey = sortKey
						expoDb.runSync(
							`UPDATE playlist_tracks SET sort_key = ? WHERE playlist_id = ? AND track_id = ?`,
							[sortKey, playlistId, trackId],
						)
					}
				}
				logger.info(`[v2] sort_key 数据迁移接力完成，共处理 ${rows.length} 行`)
			}

			expoDb.runSync(`ALTER TABLE playlist_tracks DROP COLUMN "order"`)
			migration.markAsApplied()
			logger.info('[v2] 已成功从物理表中删除 order 字段')
		})
	} catch (error) {
		logger.error('[v2] 迁移过程中发生错误，事务已回滚:', error)
	}
}
