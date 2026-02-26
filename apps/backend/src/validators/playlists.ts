import { type as arkType } from 'arktype'

const trackInputSchema = arkType({
	unique_key: 'string',
	title: 'string',
	'artist_name?': 'string',
	'artist_id?': 'string',
	'cover_url?': 'string',
	'duration?': 'number',
	bilibili_bvid: 'string',
	'bilibili_cid?': 'string',
})

const trackWithSortSchema = arkType({
	track: trackInputSchema,
	sort_key: 'string',
})

const upsertChangeSchema = arkType({
	op: "'upsert'",
	track: trackInputSchema,
	sort_key: 'string',
	operation_at: 'number',
})

const removeChangeSchema = arkType({
	op: "'remove'",
	track_unique_key: 'string',
	operation_at: 'number',
})

const reorderChangeSchema = arkType({
	op: "'reorder'",
	track_unique_key: 'string',
	sort_key: 'string',
	operation_at: 'number',
})

const changeOperationSchema = upsertChangeSchema
	.or(removeChangeSchema)
	.or(reorderChangeSchema)

export const createPlaylistRequestSchema = arkType({
	title: 'string',
	'description?': 'string',
	'cover_url?': 'string',
	'tracks?': trackWithSortSchema.array(),
})

export const updatePlaylistRequestSchema = arkType({
	'title?': 'string',
	'description?': 'string',
	'cover_url?': 'string',
})

export const playlistChangesRequestSchema = arkType({
	changes: changeOperationSchema.array(),
})

export const getPlaylistChangesRequestSchema = arkType({
	since: 'string.integer.parse',
})

export const subscribePlaylistRequestSchema = arkType({
	'invite_code?': 'string',
})
