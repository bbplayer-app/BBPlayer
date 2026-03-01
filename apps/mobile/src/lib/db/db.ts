import { drizzle } from 'drizzle-orm/expo-sqlite/driver'
import * as SQLite from 'expo-sqlite'

import * as schema from './schema'

export const expoDb = SQLite.openDatabaseSync('db.db', {
	enableChangeListener: true,
})
// SQLite 默认不强制外键约束，必须每次连接时手动开启
expoDb.execSync('PRAGMA foreign_keys = ON;')
const drizzleDb = drizzle<typeof schema>(expoDb, { schema })

export default drizzleDb
