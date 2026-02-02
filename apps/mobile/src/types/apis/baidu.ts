export interface BaiduSearchResponse {
	error_code: number
	result: {
		song_info: {
			song_list: {
				song_id: string
				title: string
				author: string
				album_title: string
				pic_small: string
				pic_premium: string
				pic_huge: string
				lrclink: string
			}[]
		}
	}
}

export interface BaiduLyricResponse {
	lrcContent: string
	title: string
}
