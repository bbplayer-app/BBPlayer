export interface Env {
	KV: {
		get(key: string): Promise<string | null>
	}
	DATABASE_URL: string
	JWT_SECRET: string
}
