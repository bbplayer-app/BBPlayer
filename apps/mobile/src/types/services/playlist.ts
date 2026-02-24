export interface CreatePlaylistPayload {
	title: string
	description?: string | null
	coverUrl?: string | null
	authorId?: number | null // 如果是本地播放列表，则为 null
	type: 'favorite' | 'collection' | 'multi_page' | 'local'
	remoteSyncId?: number | null
}

export interface UpdatePlaylistPayload {
	title?: string | null
	description?: string | null
	coverUrl?: string | null
}

export interface ReorderLocalPlaylistTrackPayload {
	trackId: number
	prevSortKey: string | null // 目标位置前一项的 sortKey，null 代表列表最前
	nextSortKey: string | null // 目标位置后一项的 sortKey，null 代表列表最后
}
