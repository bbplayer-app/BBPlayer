import type { Config } from 'drizzle-kit'
export default {
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'expo',
} satisfies Config
