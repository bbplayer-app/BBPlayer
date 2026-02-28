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
				dispatch({ type: 'migrated', payload: true })
				return
			}

			dispatch({ type: 'migrating' })

			try {
				await migrate(db, migrations)
				// SQL 迁移完成后立刻检查/执行 JS 层迁移
				migrateSortKeysV2()
				migrateSortKeysV3()

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
