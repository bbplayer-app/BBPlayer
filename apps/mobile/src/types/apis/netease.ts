export interface NeteasePlaylistResponse {
	code: number
	playlist: NeteasePlaylist
}

export interface NeteasePlaylist {
	id: number
	name: string
	coverImgId: number
	coverImgUrl: string
	userId: number
	createTime: number
	description: string | null
	tags: string[]
	backgroundCoverId: number
	backgroundCoverUrl: string | null
	subscribedCount: number
	cloudTrackCount: number
	trackCount: number
	creator: NeteaseCreator
	tracks: NeteaseSong[]
}

export interface NeteaseCreator {
	userId: number
	nickname: string
	signature: string
	description: string
	avatarUrl: string
	backgroundUrl: string
}

export interface NeteaseSong {
	id: number
	name: string
	ar: NeteaseArtist[]
	alia: string[] // Alias
	al: NeteaseAlbum
	dt: number // Duration
	tns?: string[] // Translated names
}

export interface NeteaseArtist {
	id: number
	name: string
	tns: string[]
	alias: string[]
}

export interface NeteaseAlbum {
	id: number
	name: string
	picUrl: string
	tns: string[]
}

export interface NeteaseLyricResponse {
	lrc: {
		version: number
		lyric: string
	}
	/** 翻译歌词 */
	tlyric?: {
		version: number
		lyric: string
	}
	/** 罗马音歌词 */
	romalrc?: {
		version: number
		lyric: string
	}
	/** 逐字歌词 (Verbatim) */
	yrc?: {
		version: number
		lyric: string
	}
	/** 与 yrc 相对应的翻译歌词，如果使用 yrc 就必须用这个，否则时间戳对应不上 */
	ytlrc?: {
		version: number
		lyric: string
	}
	/** 与 yrc 相对应的罗马音歌词，如果使用 yrc 就必须用这个，否则时间戳对应不上 */
	yromalrc?: {
		version: number
		lyric: string
	}
	code: number
}

export interface NeteaseSearchResponse {
	result: {
		songs: NeteaseSong[]
	}
	code: number
}
