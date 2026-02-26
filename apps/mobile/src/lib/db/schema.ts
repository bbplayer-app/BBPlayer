import { relations, sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import type { PlayRecord } from '@/types/core/media'

export const artists = sqliteTable(
	'artists',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		avatarUrl: text('avatar_url'),
		signature: text('signature'),
		source: text('source', {
			enum: ['bilibili', 'local'],
		}).notNull(),
		remoteId: text('remote_id'), // 比如 bilibili mid
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex('source_remote_id_unq')
			.on(table.source, table.remoteId)
			.where(sql`source != 'local'`),
		uniqueIndex('local_artist_unq')
			.on(table.name)
			.where(sql`source = 'local'`), // 如果是 local artist，就基于 name 唯一索引
		index('artists_name_idx').on(table.name),
		check(
			'source_integrity_check',
			sql`
        (source = 'local' AND remote_id IS NULL) 
        OR 
        (source != 'local' AND remote_id IS NOT NULL)
      `,
		),
	],
)

export const tracks = sqliteTable(
	'tracks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		uniqueKey: text('unique_key').unique().notNull(), // 唯一标识符，用于判断是否已存在，基于 source 和其对应的唯一字段生成
		title: text('title').notNull(),
		artistId: integer('artist_id').references(() => artists.id, {
			onDelete: 'set null', // 如果作者被删除，歌曲的作者ID设为NULL，歌曲本身不删除
		}),
		coverUrl: text('cover_url'),
		duration: integer('duration'),
		playHistory: text('play_history', {
			// 每次播放的时间
			mode: 'json',
		})
			.$type<PlayRecord[]>()
			.default(sql`'[]'`),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		source: text('source', {
			enum: ['bilibili', 'local'],
		}).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('tracks_artist_idx').on(table.artistId),
		index('tracks_title_idx').on(table.title),
		index('tracks_source_idx').on(table.source),
	],
)

export const playlists = sqliteTable(
	'playlists',
	{
		id: integer('id').primaryKey({ autoIncrement: true }), // 数据库内的唯一 id
		title: text('title').notNull(),
		authorId: integer('author_id').references(() => artists.id, {
			onDelete: 'set null', // 如果作者被删除，播放列表的作者ID设为NULL
		}),
		description: text('description'),
		coverUrl: text('cover_url'),
		itemCount: integer('item_count').notNull().default(0),
		type: text('type', {
			enum: ['favorite', 'collection', 'multi_page', 'local'],
		}).notNull(),
		remoteSyncId: integer('remote_sync_id'), // 当存在这个值时，这个 playlist 只能从远程同步，而不能从本地直接修改（或许也可以？因为我们已经实现了大量本地有关收藏夹的操作逻辑，先不管了~）
		lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
		// 歌单分享功能字段
		shareId: text('share_id'), // 对应后端 shared_playlists.id (UUID)，null 表示纯本地歌单
		shareRole: text('share_role', {
			enum: ['owner', 'editor', 'subscriber'],
		}), // null 表示不参与任何共享歌单
		lastShareSyncAt: integer('last_share_sync_at', { mode: 'timestamp_ms' }), // 增量同步游标，存服务端 server_time
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index('playlists_title_idx').on(table.title),
		index('playlists_type_idx').on(table.type),
		index('playlists_author_idx').on(table.authorId),
	],
)

export const playlistTracks = sqliteTable(
	'playlist_tracks',
	{
		playlistId: integer('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }), // 级联删除
		trackId: integer('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		sortKey: text('sort_key').notNull(), // 歌曲在列表中的顺序，fractional indexing 字符串键
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		primaryKey({ columns: [table.playlistId, table.trackId] }),
		index('playlist_tracks_track_idx').on(table.trackId),
		index('playlist_tracks_sort_key_idx').on(table.playlistId, table.sortKey),
	],
)

export const bilibiliMetadata = sqliteTable(
	'bilibili_metadata',
	{
		trackId: integer('track_id')
			.primaryKey()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		bvid: text('bvid').notNull(),
		cid: integer('cid'),
		isMultiPage: integer('is_multi_page', { mode: 'boolean' }).notNull(),
		mainTrackTitle: text('main_track_title'), // 如果是分 p 视频，保存该分 p 所在的主视频标题
		videoIsValid: integer('video_is_valid', { mode: 'boolean' })
			.notNull()
			.default(true), // 处理 bilibili 收藏夹中的被删除视频...
	},
	(table) => [
		index('bilibili_metadata_bvid_cid_idx').on(table.bvid, table.cid),
	],
)

export const localMetadata = sqliteTable('local_metadata', {
	trackId: integer('track_id')
		.primaryKey()
		.references(() => tracks.id, { onDelete: 'cascade' }),
	localPath: text('local_path').notNull(),
})

export const playlistSyncQueue = sqliteTable('playlist_sync_queue', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	playlistId: integer('playlist_id')
		.notNull()
		.references(() => playlists.id, { onDelete: 'cascade' }),
	operation: text('operation', {
		enum: ['add_tracks', 'remove_tracks', 'reorder_track', 'update_metadata'],
	}).notNull(),
	payload: text('payload', { mode: 'json' }).notNull(),
	status: text('status', {
		enum: ['pending', 'syncing', 'done', 'failed'],
	})
		.notNull()
		.default('pending'),
	// 用户真正执行操作的时间，入队时立刻记录，不是上传时的时间
	// 这是 LWW 冲突解决的基准时间戳，防止网络延迟重试时覆盖掉更新的操作
	operationAt: integer('operation_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
})

// ##################################
// RELATIONS
// ##################################
export const artistRelations = relations(artists, ({ many }) => ({
	tracks: many(tracks),
	authoredPlaylists: many(playlists),
}))

export const trackRelations = relations(tracks, ({ one, many }) => ({
	artist: one(artists, {
		fields: [tracks.artistId],
		references: [artists.id],
	}),
	playlistLinks: many(playlistTracks),
	bilibiliMetadata: one(bilibiliMetadata, {
		fields: [tracks.id],
		references: [bilibiliMetadata.trackId],
	}),
	localMetadata: one(localMetadata, {
		fields: [tracks.id],
		references: [localMetadata.trackId],
	}),
}))

export const playlistRelations = relations(playlists, ({ one, many }) => ({
	author: one(artists, {
		fields: [playlists.authorId],
		references: [artists.id],
	}),
	trackLinks: many(playlistTracks),
}))

export const playlistTrackRelations = relations(playlistTracks, ({ one }) => ({
	playlist: one(playlists, {
		fields: [playlistTracks.playlistId],
		references: [playlists.id],
	}),
	track: one(tracks, {
		fields: [playlistTracks.trackId],
		references: [tracks.id],
	}),
}))

export const bilibiliMetadataRelations = relations(
	bilibiliMetadata,
	({ one }) => ({
		track: one(tracks, {
			fields: [bilibiliMetadata.trackId],
			references: [tracks.id],
		}),
	}),
)

export const localMetadataRelations = relations(localMetadata, ({ one }) => ({
	track: one(tracks, {
		fields: [localMetadata.trackId],
		references: [tracks.id],
	}),
}))
