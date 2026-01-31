export interface GenericTrack {
	title: string
	artists: string[]
	album: string
	duration: number // milliseconds
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
}
