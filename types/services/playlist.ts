export interface CreatePlaylistPayload {
	title: string
	description?: string | null
	coverUrl?: string | null
	authorId?: number | null
	type: 'favorite' | 'collection' | 'multi_page' | 'local'
	remoteSyncId?: number | null
}

export interface UpdatePlaylistPayload {
	title?: string | null
	description?: string | null
	coverUrl?: string | null
}

export interface ReorderSingleTrackPayload {
	trackId: number
	fromOrder: number // 从 0 开始
	toOrder: number // 从 0 开始
}
