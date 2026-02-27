import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'

import * as schema from './schema'

export type DbConnection = {
	db: NodePgDatabase<typeof schema>
	client: Client
}
export type DrizzleDb = DbConnection['db']

export async function createDb(
	connectionString: string,
): Promise<DbConnection> {
	const client = new Client({
		connectionString,
	})

	await client.connect()

	const db = drizzle(client, { schema })

	return { db, client }
}
