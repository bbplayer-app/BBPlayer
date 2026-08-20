import { generateKeyBetween } from 'fractional-indexing'

import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'

import { DataMigration } from './state'

const logger = log.extend('migrateSortKeysV3')
const migration = new DataMigration('sort_key_v3', 'sort_key_migrated_v3') // gitleaks:allow

/** 将非 local 播放列表的 sort_key 翻转。 */
export function migrateSortKeysV3(): void {
	if (migration.isApplied()) return

	try {
		expoDb.withTransactionSync(() => {
			type PlaylistRow = { id: number }
			const playlists = expoDb.getAllSync<PlaylistRow>(
				`SELECT id FROM playlists WHERE type != 'local'`,
			)
			let totalUpdated = 0

			for (const playlist of playlists) {
				type TrackRow = { track_id: number }
				const tracks = expoDb.getAllSync<TrackRow>(
					`SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY sort_key ASC`,
					[playlist.id],
				)
				if (tracks.length === 0) continue

				const reversed = [...tracks].toReversed()
				let previousKey: string | null = null
				const newKeys = new Map<number, string>()
				for (const track of reversed) {
					const sortKey = generateKeyBetween(previousKey, null)
					previousKey = sortKey
					newKeys.set(track.track_id, sortKey)
				}

				for (const [trackId, sortKey] of newKeys) {
					expoDb.runSync(
						`UPDATE playlist_tracks SET sort_key = ? WHERE playlist_id = ? AND track_id = ?`,
						[sortKey, playlist.id, trackId],
					)
					totalUpdated++
				}
			}
			migration.markAsApplied()
			logger.info(
				`[v3] 非 local 播放列表 sort_key 翻转迁移完成，共处理 ${totalUpdated} 行`,
			)
		})
	} catch (error) {
		logger.error('[v3] 迁移过程中发生错误，事务已回滚:', error)
	}
}
