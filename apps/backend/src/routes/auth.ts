import { arktypeValidator } from '@hono/arktype-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'

import { createDb } from '../db'
import { users } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import {
	loginRequestSchema,
	registerRequestSchema,
	updateProfileRequestSchema,
} from '../validators/auth'

const PASSWORD_HASH_VERSION = 'v1'

type AuthVariables = {
	jwtPayload: {
		sub: string
	}
}

const authRoute = new Hono<{
	Bindings: Env
	Variables: AuthVariables
}>()
	.post(
		'/register',
		arktypeValidator('json', registerRequestSchema, (result, c) => {
			if (!result.success) {
				return c.json(
					{ error: 'invalid_body', summary: result.errors.summary },
					400,
				)
			}
		}),
		async (c) => {
			const body = c.req.valid('json')
			const username = normalizeUsername(body.username)
			const displayName = body.name?.trim() || username
			const face = normalizeOptionalString(body.face)

			const { db, client } = await createDb(c.env.DATABASE_URL)
			try {
				const existing = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.username, username))
					.limit(1)

				if (existing.length > 0) {
					return c.json({ error: 'username_already_exists' }, 409)
				}

				const accountId = crypto.randomUUID()
				const passwordHash = await hashPassword(body.password, c.env.JWT_SECRET)

				await db.insert(users).values({
					id: accountId,
					username,
					passwordHash,
					name: displayName,
					face,
					lastLoginAt: new Date(),
				})

				const token = await signToken(accountId, c.env.JWT_SECRET)
				return c.json({
					token,
					account: {
						id: accountId,
						username,
						name: displayName,
						face,
					},
				})
			} finally {
				await client.end()
			}
		},
	)
	.post(
		'/login',
		arktypeValidator('json', loginRequestSchema, (result, c) => {
			if (!result.success) {
				return c.json(
					{ error: 'invalid_body', summary: result.errors.summary },
					400,
				)
			}
		}),
		async (c) => {
			const body = c.req.valid('json')
			const username = normalizeUsername(body.username)

			const { db, client } = await createDb(c.env.DATABASE_URL)
			try {
				const rows = await db
					.select({
						id: users.id,
						username: users.username,
						passwordHash: users.passwordHash,
						name: users.name,
						face: users.face,
					})
					.from(users)
					.where(eq(users.username, username))
					.limit(1)

				const account = rows[0]
				if (
					!account ||
					!(await verifyPassword(
						body.password,
						account.passwordHash,
						c.env.JWT_SECRET,
					))
				) {
					return c.json({ error: 'invalid_credentials' }, 401)
				}

				await db
					.update(users)
					.set({ lastLoginAt: new Date() })
					.where(eq(users.id, account.id))

				const token = await signToken(account.id, c.env.JWT_SECRET)
				return c.json({
					token,
					account: {
						id: account.id,
						username: account.username,
						name: account.name,
						face: account.face,
					},
				})
			} finally {
				await client.end()
			}
		},
	)
	.get('/me', authMiddleware, async (c) => {
		const { sub } = c.var.jwtPayload
		const { db, client } = await createDb(c.env.DATABASE_URL)
		try {
			const rows = await db
				.select({
					id: users.id,
					username: users.username,
					name: users.name,
					face: users.face,
				})
				.from(users)
				.where(eq(users.id, sub))
				.limit(1)

			const account = rows[0]
			if (!account) {
				return c.json({ error: 'account_not_found' }, 404)
			}

			return c.json({
				account: {
					id: account.id,
					username: account.username,
					name: account.name,
					face: account.face,
				},
			})
		} finally {
			await client.end()
		}
	})
	.patch(
		'/profile',
		authMiddleware,
		arktypeValidator('json', updateProfileRequestSchema, (result, c) => {
			if (!result.success) {
				return c.json(
					{ error: 'invalid_body', summary: result.errors.summary },
					400,
				)
			}
		}),
		async (c) => {
			const { sub } = c.var.jwtPayload
			const body = c.req.valid('json')
			const name = normalizeOptionalString(body.name)
			const face = normalizeOptionalString(body.face)
			const profileUpdates: {
				name?: string
				face?: string | null
			} = {}
			if (name) profileUpdates.name = name
			if (face !== undefined) profileUpdates.face = face

			const { db, client } = await createDb(c.env.DATABASE_URL)
			try {
				const rows = await db
					.update(users)
					.set(profileUpdates)
					.where(eq(users.id, sub))
					.returning({
						id: users.id,
						username: users.username,
						name: users.name,
						face: users.face,
					})

				const account = rows[0]
				if (!account) {
					return c.json({ error: 'account_not_found' }, 404)
				}

				return c.json({
					account: {
						id: account.id,
						username: account.username,
						name: account.name,
						face: account.face,
					},
				})
			} finally {
				await client.end()
			}
		},
	)

function normalizeUsername(username: string): string {
	return username.trim().toLowerCase()
}

function normalizeOptionalString(
	value: string | undefined,
): string | null | undefined {
	if (value === undefined) return undefined
	const trimmed = value.trim()
	return trimmed ? trimmed : null
}

async function signToken(accountId: string, secret: string): Promise<string> {
	return sign(
		{
			sub: accountId,
			role: 'user',
		},
		secret,
	)
}

async function hashPassword(password: string, pepper: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	const digest = await digestPassword(password, salt, pepper)
	return `${PASSWORD_HASH_VERSION}$${bytesToBase64(salt)}$${bytesToBase64(digest)}`
}

async function verifyPassword(
	password: string,
	storedHash: string,
	pepper: string,
): Promise<boolean> {
	const [version, saltBase64, hashBase64] = storedHash.split('$')
	if (version !== PASSWORD_HASH_VERSION || !saltBase64 || !hashBase64) {
		return false
	}

	const salt = base64ToBytes(saltBase64)
	const expected = base64ToBytes(hashBase64)
	const actual = await digestPassword(password, salt, pepper)
	return constantTimeEqual(actual, expected)
}

async function digestPassword(
	password: string,
	salt: Uint8Array,
	pepper: string,
): Promise<Uint8Array> {
	const encoder = new TextEncoder()
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(`${password}:${pepper}`),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const saltBuffer = new ArrayBuffer(salt.byteLength)
	new Uint8Array(saltBuffer).set(salt)
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt: saltBuffer,
			iterations: 100000,
		},
		keyMaterial,
		256,
	)
	return new Uint8Array(bits)
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false
	let diff = 0
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i]
	}
	return diff === 0
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

export default authRoute
