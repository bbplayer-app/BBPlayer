import { drizzle } from 'drizzle-orm/expo-sqlite/driver'
import { Context, Layer } from 'effect'
import * as SQLite from 'expo-sqlite'
import * as schema from './schema'

export const expoDb = SQLite.openDatabaseSync('db.db', {
	enableChangeListener: true,
})

export const dbClient = drizzle(expoDb, { schema })

export type DrizzleDb = typeof dbClient

export class DrizzleDB extends Context.Tag('DrizzleDB')<
	DrizzleDB,
	DrizzleDb
>() {}

export const DatabaseLive = Layer.succeed(DrizzleDB, dbClient)
