import { expoDb } from '@/lib/db/db'
import { storage } from '@/utils/mmkv'

const DATA_MIGRATIONS_TABLE = '__bbplayer_data_migrations'

export const legacyMigrationKeys = [
	'db_schema_version',
	'sort_key_migrated_v1',
	'sort_key_migrated_v2', // gitleaks:allow
	'sort_key_migrated_v3',
	'play_history_migrated_v1',
	'independent_account_migrated_v1',
	'play_history_ms_migrated_v1',
] as const

type LegacyDataMigrationKey = Exclude<
	(typeof legacyMigrationKeys)[number],
	'db_schema_version' | 'sort_key_migrated_v1'
>

/** A JS data migration and its one-time legacy MMKV marker. */
export class DataMigration {
	public constructor(
		private readonly name: string,
		private readonly legacyStorageKey: LegacyDataMigrationKey,
	) {}

	public isApplied(): boolean {
		expoDb.execSync(
			`CREATE TABLE IF NOT EXISTS ${DATA_MIGRATIONS_TABLE} (name TEXT PRIMARY KEY NOT NULL)`,
		)

		const applied = expoDb.getFirstSync<{ name: string }>(
			`SELECT name FROM ${DATA_MIGRATIONS_TABLE} WHERE name = ?`,
			[this.name],
		)
		if (applied) {
			storage.remove(this.legacyStorageKey)
			return true
		}

		const appliedInLegacyStorage =
			storage.getBoolean(this.legacyStorageKey) === true
		if (appliedInLegacyStorage) {
			this.markAsApplied()
		}
		storage.remove(this.legacyStorageKey)

		return appliedInLegacyStorage
	}

	public markAsApplied(): void {
		expoDb.runSync(
			`INSERT OR IGNORE INTO ${DATA_MIGRATIONS_TABLE} (name) VALUES (?)`,
			[this.name],
		)
	}
}

/** The SQL migration journal replaces these two obsolete MMKV-only markers. */
export function clearObsoleteLegacyMigrationKeys(): void {
	storage.remove('db_schema_version')
	storage.remove('sort_key_migrated_v1')
}

/** Never let a destination device's legacy flags affect a restored database. */
export function clearLegacyMigrationKeys(): void {
	for (const key of legacyMigrationKeys) {
		storage.remove(key)
	}
}
