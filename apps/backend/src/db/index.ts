import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * 工厂函数：每次请求按需创建 Drizzle 实例和 Postgres 客户端。
 * 返回 { db, client }，以便路由在完成后调用 client.end() 关闭连接。
 */
export function createDb(connectionString: string) {
	const client = postgres(connectionString, { prepare: false, max: 1 })
	const db = drizzle(client, { schema })
	return { db, client }
}

export type DbConnection = ReturnType<typeof createDb>
export type DrizzleDb = DbConnection['db']
