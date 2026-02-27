import { drizzle } from 'drizzle-orm/postgres-js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Sql } from 'postgres'

import * as schema from './schema'

let client: Sql | null = null
let db: PostgresJsDatabase<typeof schema> | null = null
let lastConnectionString: string | null = null

export function createDb(connectionString: string) {
	if (!client || connectionString !== lastConnectionString) {
		if (client) {
			void client.end()
		}
		client = postgres(connectionString, {
			prepare: false,
			max: 1,
			idle_timeout: 20,
			connect_timeout: 10,
		})
		db = drizzle(client, { schema })
		lastConnectionString = connectionString
	}
	return { db: db!, client }
}

export type DbConnection = {
	db: PostgresJsDatabase<typeof schema>
	client: Sql
}
export type DrizzleDb = DbConnection['db']
