import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite/driver'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import { useEffect, useReducer } from 'react'

import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

const logger = log.extend('useFastMigrations')
const SCHEMA_VERSION_KEY = 'db_schema_version'

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
				dispatch({ type: 'migrated', payload: true })
				return
			}

			dispatch({ type: 'migrating' })

			try {
				await migrate(db, migrations)

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
