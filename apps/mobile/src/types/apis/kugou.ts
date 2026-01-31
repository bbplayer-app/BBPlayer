export interface KugouSearchResponse {
	status: number
	data: {
		info: {
			hash: string
			filename: string
			album_name: string
			duration: number // assume seconds
			singername: string
			songname: string
		}[]
		total: number
	}
}

export interface KugouLyricSearchResponse {
	status: number
	candidates: {
		id: string
		accesskey: string
		fmt: string
		duration: number
		singer: string
		song: string
	}[]
}

export interface KugouLyricDownloadResponse {
	status: number
	content: string // Base64 encoded lrc
	fmt: string
}
