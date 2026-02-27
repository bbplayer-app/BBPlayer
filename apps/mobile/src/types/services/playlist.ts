export type SharedPlaylistRole = 'owner' | 'editor' | 'subscriber'

export interface CreatePlaylistPayload {
	title: string
	description?: string | null
	coverUrl?: string | null
	authorId?: number | null // 如果是本地播放列表，则为 null
	type: 'favorite' | 'collection' | 'multi_page' | 'local'
	remoteSyncId?: number | null
	shareId?: string | null
	shareRole?: SharedPlaylistRole | null
	lastShareSyncAt?: number | null
}

export interface UpdatePlaylistPayload {
	title?: string | null
	description?: string | null
	coverUrl?: string | null
	// 共享歌单升级/降级字段：普通本地歌单 → 共享歌单时需要更新这三个字段
	shareId?: string | null
	shareRole?: SharedPlaylistRole | null
	lastShareSyncAt?: number | null
}

export interface ReorderLocalPlaylistTrackPayload {
	trackId: number
	prevSortKey: string | null // 目标位置前一项的 sortKey，null 代表列表最前
	nextSortKey: string | null // 目标位置后一项的 sortKey，null 代表列表最后
}
