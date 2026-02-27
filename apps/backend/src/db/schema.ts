import { sql } from 'drizzle-orm'
import {
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	/** B 站 mid */
	mid: text('mid').primaryKey(),
	name: text('name').notNull(),
	face: text('face'),
	lastLoginAt: timestamp('last_login_at', { withTimezone: true })
		.notNull()
		.default(sql`now()`),
})

export const sharedPlaylists = pgTable(
	'shared_playlists',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		ownerMid: text('owner_mid')
			.notNull()
			.references(() => users.mid, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		coverUrl: text('cover_url'),
		/** 编辑者邀请码（明文存储，旋转后旧码失效） */
		editorInviteCode: text('editor_invite_code'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`now()`),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.default(sql`now()`),
		/** 软删除；非 null 表示已删除 */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(t) => [
		uniqueIndex('editor_invite_code_unq')
			.on(t.editorInviteCode)
			.where(sql`${t.editorInviteCode} IS NOT NULL`),
	],
)

export const playlistMembers = pgTable(
	'playlist_members',
	{
		playlistId: uuid('playlist_id')
			.notNull()
			.references(() => sharedPlaylists.id, { onDelete: 'cascade' }),
		mid: text('mid')
			.notNull()
			.references(() => users.mid, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'editor', 'subscriber'] }).notNull(),
		joinedAt: timestamp('joined_at', { withTimezone: true })
			.notNull()
			.default(sql`now()`),
	},
	(t) => [primaryKey({ columns: [t.playlistId, t.mid] })],
)

export const sharedTracks = pgTable('shared_tracks', {
	uniqueKey: text('unique_key').primaryKey(),
	title: text('title').notNull(),
	/** 反归一化，简化查询 */
	artistName: text('artist_name'),
	/** 可能是 mid 或其他标识 */
	artistId: text('artist_id'),
	coverUrl: text('cover_url'),
	duration: integer('duration'),
	bilibiliBvid: text('bilibili_bvid').notNull(),
	bilibiliCid: text('bilibili_cid'),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.default(sql`now()`),
})

export const sharedPlaylistTracks = pgTable(
	'shared_playlist_tracks',
	{
		playlistId: uuid('playlist_id')
			.notNull()
			.references(() => sharedPlaylists.id, { onDelete: 'cascade' }),
		trackUniqueKey: text('track_unique_key')
			.notNull()
			.references(() => sharedTracks.uniqueKey, { onDelete: 'cascade' }),
		sortKey: text('sort_key').notNull(),
		addedByMid: text('added_by_mid').references(() => users.mid, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.default(sql`now()`),
		/** reorder 时也更新此字段；LWW 以此为基准 */
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.default(sql`now()`),
		/** 软删除；驱动增量同步的 delete 事件 */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(t) => [
		primaryKey({ columns: [t.playlistId, t.trackUniqueKey] }),
		index('spt_playlist_updated_idx').on(t.playlistId, t.updatedAt),
		index('spt_playlist_deleted_idx').on(t.playlistId, t.deletedAt),
	],
)

export type User = typeof users.$inferSelect
export type SharedPlaylist = typeof sharedPlaylists.$inferSelect
export type PlaylistMember = typeof playlistMembers.$inferSelect
export type SharedTrack = typeof sharedTracks.$inferSelect
export type SharedPlaylistTrack = typeof sharedPlaylistTracks.$inferSelect
