import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite/driver'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import { generateKeyBetween } from 'fractional-indexing'
import { useEffect, useReducer } from 'react'

import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

const logger = log.extend('useFastMigrations')
const SCHEMA_VERSION_KEY = 'db_schema_version'
/** 标记 sort_key JS 迁移是否已完成，避免每次启动都扫描 */
const SORT_KEY_MIGRATED_KEY = 'sort_key_migrated_v1' // gitleaks:allow

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

/**
 * 将 playlist_tracks 中 sort_key = '' 的行从旧 integer `order` 列迁移到
 * fractional indexing 字符串键。
 *
 * 每个 playlist 按旧的 `order` ASC 排序，依次用 generateKeyBetween 生成升序
 * sort_key。UI 端仍用 DESC 展示（最新的 sort_key 最大），与之前 desc(order) 一致。
 */
function migrateSortKeys(): void {
	if (storage.getBoolean(SORT_KEY_MIGRATED_KEY)) return

	// 读出所有 sort_key 为空的行，按 playlist / order 排序
	// 此时 `order` 列仍存在（SQL migration 未删除），可以直接读取
	type Row = { playlist_id: number; track_id: number }
	const rows = expoDb.getAllSync<Row>(
		`SELECT playlist_id, track_id
     FROM playlist_tracks
     WHERE sort_key = ''
     ORDER BY playlist_id ASC, "order" ASC, rowid ASC`,
	)

	if (rows.length === 0) {
		storage.set(SORT_KEY_MIGRATED_KEY, true)
		return
	}

	// 按 playlist 分组
	const grouped = new Map<number, number[]>()
	for (const row of rows) {
		const arr = grouped.get(row.playlist_id) ?? []
		arr.push(row.track_id)
		grouped.set(row.playlist_id, arr)
	}

	// 对每个 playlist 生成 sort_key 并逐行 UPDATE（同步，在主线程 SQLite 上跑）
	expoDb.withTransactionSync(() => {
		for (const [playlistId, trackIds] of grouped) {
			let prevKey: string | null = null
			for (const trackId of trackIds) {
				const sortKey = generateKeyBetween(prevKey, null)
				prevKey = sortKey
				expoDb.runSync(
					`UPDATE playlist_tracks SET sort_key = ? WHERE playlist_id = ? AND track_id = ?`,
					[sortKey, playlistId, trackId],
				)
			}
		}
	})

	logger.info(`sort_key 迁移完成，共处理 ${rows.length} 行`)
	storage.set(SORT_KEY_MIGRATED_KEY, true)
}

/**
 * 通过在 MMKV 中缓存最新的迁移版本号，避免每次启动都执行 SQL 查询检查迁移状态。
 *
 * （我没想到性能差异会这么大，大约是 5000x 的提升...从 300ms 到 0.06ms...）
 */
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
				// SQL 迁移已是最新，但仍需执行 JS 层数据迁移（有 MMKV flag 保护，冷路径极快）
				migrateSortKeys()
				dispatch({ type: 'migrated', payload: true })
				return
			}

			dispatch({ type: 'migrating' })

			try {
				await migrate(db, migrations)
				// SQL 迁移完成后立刻执行 JS 层数据迁移
				migrateSortKeys()

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
