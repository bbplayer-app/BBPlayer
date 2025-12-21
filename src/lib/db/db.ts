import { drizzle } from 'drizzle-orm/expo-sqlite/driver'
import { Context, Effect, Layer } from 'effect'
import * as SQLite from 'expo-sqlite'
import * as schema from './schema'

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>
export class DrizzleDB extends Context.Tag('DrizzleDB')<
	DrizzleDB,
	DrizzleDb
>() {}

export const DatabaseLive = Layer.effect(
	DrizzleDB,
	Effect.sync(() => {
		const expoDb = SQLite.openDatabaseSync('db.db', {
			enableChangeListener: true,
		})
		const db = drizzle<typeof schema>(expoDb, { schema })
		return db
	}),
)
