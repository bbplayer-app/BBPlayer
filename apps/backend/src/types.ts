/** JWT payload 结构 */
export interface JwtTokenPayload {
	sub: string // B 站 mid（text 存储，避免大数精度丢失）
	jwtVersion: number
	iat: number
	exp: number
}

/** POST /api/playlists/:id/changes — 请求体单条变更 */
export type ChangeOperation =
	| {
			op: 'upsert'
			track: TrackInput
			sort_key: string
			operation_at: number
	  }
	| {
			op: 'remove'
			track_unique_key: string
			operation_at: number
	  }
	| {
			op: 'reorder'
			track_unique_key: string
			sort_key: string
			operation_at: number
	  }

export interface TrackInput {
	unique_key: string
	title: string
	artist_name?: string
	artist_id?: string
	cover_url?: string
	duration?: number
	bilibili_bvid: string
	bilibili_cid?: string
}

/** GET /api/playlists/:id/changes — 响应体单条变更 */
export type ChangeEvent =
	| {
			op: 'upsert'
			track: TrackInput
			sort_key: string
			updated_at: number
	  }
	| {
			op: 'delete'
			track_unique_key: string
			deleted_at: number
	  }
