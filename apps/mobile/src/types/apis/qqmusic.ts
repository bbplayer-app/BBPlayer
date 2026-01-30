export interface QQMusicSearchResponse {
	code: number
	req: {
		code: number
		data: {
			body: {
				song: {
					list: QQMusicSong[]
				}
			}
		}
		meta: {
			cid: number
			curpage: number
			dir: string
			display_num: number
			ein: number
			next_page: number
			next_page_start: number
			num: number
			num_per_page: number
			p: number
			sin: number
			sum: number
			total_num: number
			uid: string
		}
	}
}

export interface QQMusicSong {
	id: number
	mid: string
	name: string
	title: string
	subtitle: string
	singer: {
		id: number
		mid: string
		name: string
		title: string
		type: number
		uin: number
	}[]
	album: {
		id: number
		mid: string
		name: string
		title: string
		subtitle: string
		time_public: string
		pmid: string
	}
	mv: {
		id: number
		vid: string
		name: string
		title: string
		vt: number
	}
	interval: number // Duration in seconds
	// ... there are many other fields but we primarily need id, mid, name, singer, and interval
}

export interface QQMusicLyricResponse {
	retcode: number
	code: number
	subcode: number
	lyric: string
	trans: string
}
