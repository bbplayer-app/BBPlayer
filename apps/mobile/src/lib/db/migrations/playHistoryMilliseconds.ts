import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'

import { DataMigration } from './state'

const logger = log.extend('migratePlayHistoryToMs')
const migration = new DataMigration(
	'play_history_ms_v1',
	'play_history_ms_migrated_v1',
)

/** 将秒级 play_history.start_time 统一为毫秒级。 */
export function migratePlayHistoryToMs(): void {
	if (migration.isApplied()) return

	try {
		expoDb.withTransactionSync(() => {
			expoDb.runSync(
				`UPDATE play_history SET start_time = CAST(start_time * 1000 AS INTEGER) WHERE start_time < 10000000000`,
			)
			migration.markAsApplied()
		})
		logger.info('[play_history] 秒级 start_time 已统一转为毫秒级')
	} catch (error) {
		logger.error('[play_history] 秒级 start_time 转换失败:', error)
	}
}
