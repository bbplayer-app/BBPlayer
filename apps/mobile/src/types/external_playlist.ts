export interface BilibiliTrackExtension {
	bvid: string
	cid?: number | undefined
	isMultiPage?: boolean | undefined
	mainTrackTitle?: string | undefined
	upMid?: string | undefined
	upAvatarUrl?: string | undefined
	upSignature?: string | undefined
}

export interface BilibiliPlaylistExtension {
	playlistType?:
		| 'local'
		| 'favorite'
		| 'collection'
		| 'series'
		| 'multiPage'
		| 'dynamic'
		| undefined
	remoteSyncId?: number | undefined
	creatorMid?: string | undefined
}

export interface GenericTrack {
	title: string
	artists: string[]
	album: string
	duration: number // milliseconds
	coverUrl?: string | undefined
	translatedTitle?: string | undefined
	isAvailable?: boolean | undefined
	bilibili?: BilibiliTrackExtension | undefined
}

export interface GenericPlaylist {
	id: string
	title: string
	coverUrl: string
	description: string
	trackCount: number
	author: {
		name: string
		id?: string | number
	}
	createTime?: string
	updateTime?: string
	tags?: string[]
	playCount?: number
	platform?: string
	bilibili?: BilibiliPlaylistExtension
}

export interface CanonicalExportTrack {
	index: number
	title: string
	artist: string
	album?: string
	id?: string
	isrc?: string
	durationMs?: number
	releaseDate?: string
	trackNumber?: number
	discNumber?: number
	sourceUrl?: string
	playbackUrl?: string
	coverUrl?: string
	isOriginalSound?: boolean
	isVip?: boolean
	isAvailable?: boolean
	status?: 'playable' | 'unplayable' | 'vip' | 'paid' | 'geo_blocked'
	statusText?: string
	maxQuality?: string
	mvId?: string
	mvUrl?: string
	bilibili?: BilibiliTrackExtension
}

export interface CanonicalExportPlaylist {
	generator: 'PlaylistOut'
	generatorUrl: 'https://playlistout.lengxiqwq.com'
	exportedFrom: 'BBPlayer' | 'PlaylistOutWeb' | 'MusicFree'
	exportedAt: string
	name: string
	creator?: string
	coverUrl?: string
	platform: 'qqmusic' | 'netease' | 'kugou' | 'qishui' | 'bilibili'
	id: string
	sourceUrl?: string
	trackCount: number
	loadedTrackCount?: number
	isPartial?: boolean
	createTime?: string
	updateTime?: string
	totalDuration?: string
	totalDurationMs?: number
	loadedDuration?: string
	loadedDurationMs?: number
	playCount?: number
	tags?: string[]
	description?: string
	bilibili?: BilibiliPlaylistExtension
	tracks: CanonicalExportTrack[]
}
