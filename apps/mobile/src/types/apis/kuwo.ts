export interface KuwoSearchResponse {
	code: number
	message: string
	data: {
		total: string
		list: {
			rid: number
			name: string
			artist: string
			album: string
			hasmv: number
			releaseDate: string
			songTimeMinutes: string
			isListenFee: boolean
			pic: string
			albumid: number
			artistid: number
			duration: number // assume seconds based on meting
		}[]
	}
}

export interface KuwoLyricResponse {
	status: number
	data: {
		lrclist: {
			lineLyric: string
			time: string // e.g. "0.33"
		}[]
	}
}
