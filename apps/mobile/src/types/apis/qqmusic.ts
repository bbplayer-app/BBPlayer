import { type } from 'arktype'

const QQMusicSinger = type({
	id: 'number',
	mid: 'string',
	name: 'string',
	title: 'string',
	type: 'number',
	uin: 'number',
})

const QQMusicSong = type({
	id: 'number',
	mid: 'string',
	name: 'string',
	title: 'string',
	subtitle: 'string',
	singer: QQMusicSinger.array(),
	album: {
		id: 'number',
		mid: 'string',
		name: 'string',
		title: 'string',
		subtitle: 'string',
		time_public: 'string',
		pmid: 'string',
	},
	mv: {
		id: 'number',
		vid: 'string',
		name: 'string',
		title: 'string',
		vt: 'number',
	},
	interval: 'number', // Duration in seconds
})

const QQMusicSearchResponse = type({
	code: 'number',
	req: {
		code: 'number',
		data: {
			body: {
				song: {
					list: QQMusicSong.array(),
				},
			},
		},
		meta: {
			cid: 'number',
			curpage: 'number',
			dir: 'string',
			display_num: 'number',
			ein: 'number',
			next_page: 'number',
			next_page_start: 'number',
			num: 'number',
			num_per_page: 'number',
			p: 'number',
			sin: 'number',
			sum: 'number',
			total_num: 'number',
			uid: 'string',
		},
	},
})

const QQMusicLyricResponse = type({
	retcode: 'number',
	code: 'number',
	subcode: 'number',
	lyric: 'string',
	trans: 'string',
})

const QQMusicPlaylist = type({
	disstid: 'string',
	dissname: 'string',
	desc: 'string',
	songnum: 'number',
	logo: 'string',
	nickname: 'string',
	songlist: QQMusicSong.array(),
})

const QQMusicPlaylistResponse = type({
	code: 'number',
	data: {
		cdlist: QQMusicPlaylist.array(),
	},
})

// Export Types inferred from Validators
type QQMusicSinger = typeof QQMusicSinger.infer
type QQMusicSong = typeof QQMusicSong.infer
type QQMusicSearchResponse = typeof QQMusicSearchResponse.infer
type QQMusicLyricResponse = typeof QQMusicLyricResponse.infer
type QQMusicPlaylist = typeof QQMusicPlaylist.infer
type QQMusicPlaylistResponse = typeof QQMusicPlaylistResponse.infer

export {
	QQMusicLyricResponse,
	QQMusicPlaylist,
	QQMusicPlaylistResponse,
	QQMusicSearchResponse,
	QQMusicSinger,
	QQMusicSong,
}
