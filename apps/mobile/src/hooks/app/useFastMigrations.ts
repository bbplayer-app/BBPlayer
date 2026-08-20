import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite/driver'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import { useEffect, useReducer } from 'react'

import {
	clearObsoleteLegacyMigrationKeys,
	migrateIndependentAccountReset,
	migratePlayHistory,
	migratePlayHistoryToMs,
	migrateSortKeysV2,
	migrateSortKeysV3,
} from '@/lib/db/migrations'
import log from '@/utils/log'

const logger = log.extend('useFastMigrations')

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
			dispatch({ type: 'migrating' })

			try {
				await migrate(db, migrations)
				clearObsoleteLegacyMigrationKeys()
				migrateSortKeysV2()
				migrateSortKeysV3()
				migratePlayHistory()
				migrateIndependentAccountReset()
				migratePlayHistoryToMs()
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
