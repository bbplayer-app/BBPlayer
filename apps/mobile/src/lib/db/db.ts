import { drizzle } from 'drizzle-orm/expo-sqlite/driver'
import * as SQLite from 'expo-sqlite'

import * as schema from './schema'

export const expoDb = SQLite.openDatabaseSync('db.db', {
	enableChangeListener: true,
})

// SQLite 默认不强制外键约束，必须每次连接时手动开启
expoDb.execSync('PRAGMA foreign_keys = ON;')

// WAL 让读写互不阻塞；该设置写入文件头，之后的连接都会沿用
expoDb.execSync('PRAGMA journal_mode = WAL;')

const drizzleDb = drizzle<typeof schema>(expoDb, { schema })

export default drizzleDb
