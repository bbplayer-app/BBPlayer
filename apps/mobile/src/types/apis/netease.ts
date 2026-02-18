import { type } from 'arktype'

const NeteaseArtist = type({
	id: 'number',
	name: 'string',
	tns: 'string[]',
	alias: 'string[]',
})

const NeteaseAlbum = type({
	id: 'number',
	name: 'string',
	picUrl: 'string',
	tns: 'string[]',
})

const NeteaseSong = type({
	id: 'number',
	name: 'string',
	ar: NeteaseArtist.array(),
	alia: 'string[]', // Alias
	al: NeteaseAlbum,
	dt: 'number', // Duration
	'tns?': 'string[]', // Translated names
})

const NeteaseCreator = type({
	userId: 'number',
	nickname: 'string',
	signature: 'string',
	description: 'string',
	avatarUrl: 'string',
	backgroundUrl: 'string',
})

const NeteasePlaylist = type({
	id: 'number',
	name: 'string',
	coverImgId: 'number',
	coverImgUrl: 'string',
	userId: 'number',
	createTime: 'number',
	description: 'string | null',
	tags: 'string[]',
	backgroundCoverId: 'number',
	backgroundCoverUrl: 'string | null',
	subscribedCount: 'number',
	cloudTrackCount: 'number',
	trackCount: 'number',
	'creator?': NeteaseCreator.or('null'),
	'tracks?': NeteaseSong.array().or('null'),
})

const NeteasePlaylistResponse = type({
	code: 'number',
	'playlist?': NeteasePlaylist,
})

const LyricEntry = type({
	version: 'number',
	lyric: 'string',
})

const NeteaseLyricResponse = type({
	lrc: LyricEntry,
	/** 翻译歌词 */
	'tlyric?': LyricEntry,
	/** 罗马音歌词 */
	'romalrc?': LyricEntry,
	/** 逐字歌词 (Verbatim) */
	'yrc?': LyricEntry,
	/** 与 yrc 相对应的翻译歌词，如果使用 yrc 就必须用这个，否则时间戳对应不上 */
	'ytlrc?': LyricEntry,
	/** 与 yrc 相对应的罗马音歌词，如果使用 yrc 就必须用这个，否则时间戳对应不上 */
	'yromalrc?': LyricEntry,
	code: 'number',
})

const NeteaseSearchResponse = type({
	result: {
		songs: NeteaseSong.array(),
	},
	code: 'number',
})

// Export Types inferred from Validators
type NeteaseArtist = typeof NeteaseArtist.infer
type NeteaseAlbum = typeof NeteaseAlbum.infer
type NeteaseSong = typeof NeteaseSong.infer
type NeteaseCreator = typeof NeteaseCreator.infer
type NeteasePlaylist = typeof NeteasePlaylist.infer
type NeteasePlaylistResponse = typeof NeteasePlaylistResponse.infer
type NeteaseLyricResponse = typeof NeteaseLyricResponse.infer
type NeteaseSearchResponse = typeof NeteaseSearchResponse.infer

export {
	NeteaseAlbum,
	NeteaseArtist,
	NeteaseCreator,
	NeteaseLyricResponse,
	NeteasePlaylist,
	NeteasePlaylistResponse,
	NeteaseSearchResponse,
	NeteaseSong,
}
