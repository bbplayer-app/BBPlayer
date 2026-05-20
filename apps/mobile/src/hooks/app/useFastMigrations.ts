import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite/driver'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import { generateKeyBetween } from 'fractional-indexing'
import { useEffect, useReducer } from 'react'

import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

const logger = log.extend('useFastMigrations')
const SCHEMA_VERSION_KEY = 'db_schema_version'

const SORT_KEY_MIGRATED_V2_KEY = 'sort_key_migrated_v2' // gitleaks:allow
const SORT_KEY_MIGRATED_V3_KEY = 'sort_key_migrated_v3' // gitleaks:allow
const PLAY_HISTORY_MIGRATED_V1_KEY = 'play_history_migrated_v1' // gitleaks:allow
const INDEPENDENT_ACCOUNT_MIGRATED_V1_KEY = 'independent_account_migrated_v1' // gitleaks:allow

interface MigrationConfig {
	journal: {
		entries: { idx: number; when: number; tag: string; breakpoints: boolean }[]
	}
	migrations: Record<string, string>
}

interface State {
	success: boolean
	error?: Error
}

type Action =
	| { type: 'migrating' }
	| { type: 'migrated'; payload: true }
	| { type: 'error'; payload: Error }

function migrateSortKeysV2(): void {
	if (storage.getBoolean(SORT_KEY_MIGRATED_V2_KEY)) return

	try {
		const tableInfo = expoDb.getAllSync<{ name: string }>(
			`PRAGMA table_info(playlist_tracks)`,
		)
		const hasOrderColumn = tableInfo.some((col) => col.name === 'order')

		if (!hasOrderColumn) {
			logger.info('[v2] 物理表中已无 order 字段，无需执行数据迁移与删除操作')
			storage.set(SORT_KEY_MIGRATED_V2_KEY, true)
			return
		}

		expoDb.withTransactionSync(() => {
			// 1. 读取需要迁移的数据
			type Row = { playlist_id: number; track_id: number }
			const rows = expoDb.getAllSync<Row>(
				`SELECT playlist_id, track_id
                 FROM playlist_tracks
                 WHERE sort_key = '' OR sort_key IS NULL
                 ORDER BY playlist_id ASC, "order" ASC, rowid ASC`,
			)

			if (rows.length > 0) {
				// 2. 读取当前各个歌单的最大 sort_key 作为接力起点
				type MaxKeyRow = { playlist_id: number; max_key: string }
				const maxKeys = expoDb.getAllSync<MaxKeyRow>(
					`SELECT playlist_id, MAX(sort_key) as max_key
                     FROM playlist_tracks
                     WHERE sort_key != '' AND sort_key IS NOT NULL
                     GROUP BY playlist_id`,
				)

				const maxKeyMap = new Map<number, string>()
				for (const row of maxKeys) {
					maxKeyMap.set(row.playlist_id, row.max_key)
				}

				// 按 playlist 分组
				const grouped = new Map<number, number[]>()
				for (const row of rows) {
					const arr = grouped.get(row.playlist_id) ?? []
					arr.push(row.track_id)
					grouped.set(row.playlist_id, arr)
				}

				// 3. 执行更新操作
				for (const [playlistId, trackIds] of grouped) {
					let prevKey: string | null = maxKeyMap.get(playlistId) || null

					for (const trackId of trackIds) {
						const sortKey = generateKeyBetween(prevKey, null)
						prevKey = sortKey
						expoDb.runSync(
							`UPDATE playlist_tracks SET sort_key = ? WHERE playlist_id = ? AND track_id = ?`,
							[sortKey, playlistId, trackId],
						)
					}
				}
				logger.info(`[v2] sort_key 数据迁移接力完成，共处理 ${rows.length} 行`)
			}

			expoDb.runSync(`ALTER TABLE playlist_tracks DROP COLUMN "order"`)
			logger.info('[v2] 已成功从物理表中删除 order 字段')
		})

		storage.set(SORT_KEY_MIGRATED_V2_KEY, true)
	} catch (error) {
		logger.error('[v2] 迁移过程中发生错误，事务已回滚:', error)
	}
}

/**
 * V3 迁移：将非 local 播放列表的 sort_key 翻转。
 */
function migrateSortKeysV3(): void {
	if (storage.getBoolean(SORT_KEY_MIGRATED_V3_KEY)) return

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

				// 倒序分配新 sort_key：原来 position 1 的 track 获得最大的 sort_key
				// 改为 DESC 查询后显示顺序维持不变
				const reversed = [...tracks].toReversed()
				let prevKey: string | null = null
				const newKeys = new Map<number, string>()
				for (const track of reversed) {
					const sortKey = generateKeyBetween(prevKey, null)
					prevKey = sortKey
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

			logger.info(
				`[v3] 非 local 播放列表 sort_key 翻转迁移完成，共处理 ${totalUpdated} 行`,
			)
		})
		storage.set(SORT_KEY_MIGRATED_V3_KEY, true)
	} catch (error) {
		logger.error('[v3] 迁移过程中发生错误，事务已回滚:', error)
	}
}

/**
 * 迁移播放历史数据：从 tracks 表的 JSON 迁移到 play_history 表。
 */
function migratePlayHistory(): void {
	if (storage.getBoolean(PLAY_HISTORY_MIGRATED_V1_KEY)) return

	try {
		// 1. 检查 tracks 表是否还有 play_history 列
		const tracksTableInfo = expoDb.getAllSync<{ name: string }>(
			`PRAGMA table_info(tracks)`,
		)
		const hasOldColumn = tracksTableInfo.some(
			(col) => col.name === 'play_history',
		)

		if (!hasOldColumn) {
			logger.info(
				'[play_history] tracks 表中无 play_history 字段，无需执行数据迁移',
			)
			storage.set(PLAY_HISTORY_MIGRATED_V1_KEY, true)
			return
		}

		// 2. 检查 play_history 表是否已经创建
		const masterInfo = expoDb.getAllSync<{ name: string }>(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='play_history'`,
		)
		if (masterInfo.length === 0) {
			logger.warning('[play_history] play_history 表尚未创建，跳过本次数据迁移')
			return
		}

		expoDb.withTransactionSync(() => {
			type Row = { id: number; play_history: string }
			const rows = expoDb.getAllSync<Row>(
				`SELECT id, play_history FROM tracks WHERE play_history IS NOT NULL AND play_history != '[]'`,
			)

			if (rows.length > 0) {
				logger.info(
					`[play_history] 发现 ${rows.length} 个带有播放记录的歌曲，准备迁移...`,
				)
				for (const row of rows) {
					const history = JSON.parse(row.play_history)
					if (Array.isArray(history)) {
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
				}
				logger.info(
					`[play_history] 播放记录迁移完成，共处理 ${rows.length} 条歌曲记录`,
				)
			}
		})

		storage.set(PLAY_HISTORY_MIGRATED_V1_KEY, true)
	} catch (error) {
		// 这里不吃掉错误，而是让它打印出来，并且不设置 storage 标记，下次启动还会重试
		logger.error('[play_history] 迁移过程中发生致命错误:', error)
	}
}

/**
 * 旧共享歌单以 B 站身份为账号边界。新账号体系独立后，升级时将本地共享状态全部退回普通本地歌单。
 */
function migrateIndependentAccountReset(): void {
	if (storage.getBoolean(INDEPENDENT_ACCOUNT_MIGRATED_V1_KEY)) return

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
		})

		storage.remove('shared-playlist-members')
		storage.remove('bbplayer_jwt')
		storage.set(INDEPENDENT_ACCOUNT_MIGRATED_V1_KEY, true)
		logger.info('[account] 已清空旧共享歌单状态与同步队列')
	} catch (error) {
		logger.error('[account] 清空旧共享歌单状态失败:', error)
	}
}

export const useFastMigrations = (
	db: ExpoSQLiteDatabase<Record<string, unknown>>,
	migrations: MigrationConfig,
): State => {
	const initialState: State = {
		success: false,
		error: undefined,
	}

	const fetchReducer = (state: State, action: Action): State => {
		switch (action.type) {
			case 'migrating': {
				return { ...initialState }
			}
			case 'migrated': {
				return { ...initialState, success: action.payload }
			}
			case 'error': {
				return { ...initialState, error: action.payload }
			}
			default: {
				return state
			}
		}
	}

	const [state, dispatch] = useReducer(fetchReducer, initialState)

	useEffect(() => {
		const runMigration = async () => {
			const cachedVersion = storage.getNumber(SCHEMA_VERSION_KEY)
			const latestVersion = migrations.journal.entries.at(-1)?.when ?? 0

			if (cachedVersion === latestVersion) {
				// SQL 迁移已是最新，检查/执行 JS 层迁移
				migrateSortKeysV2()
				migrateSortKeysV3()
				migratePlayHistory()
				migrateIndependentAccountReset()
				dispatch({ type: 'migrated', payload: true })
				return
			}

			dispatch({ type: 'migrating' })

			try {
				await migrate(db, migrations)
				// SQL 迁移完成后立刻检查/执行 JS 层迁移
				migrateSortKeysV2()
				migrateSortKeysV3()
				migratePlayHistory()
				migrateIndependentAccountReset()

				storage.set(SCHEMA_VERSION_KEY, latestVersion)
				dispatch({ type: 'migrated', payload: true })
			} catch (error) {
				logger.error('迁移失败:', error)
				dispatch({ type: 'error', payload: error as Error })
			}
		}

		void runMigration()
	}, [db, migrations])

	return state
}
