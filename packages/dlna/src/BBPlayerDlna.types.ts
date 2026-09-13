export interface DlnaDevice {
	name: string
	location: string
	controlURL: string
	renderingControlURL?: string | null
	udn?: string | null
	manufacturer?: string | null
	model?: string | null
}

export interface CastOptions {
	controlURL: string
	title: string
	mime?: string
	sourceUrl?: string
	filePath?: string
	headers?: Record<string, string>
	headersJson?: string
	renderingControlURL?: string
}

export interface CastSession {
	listenUrl: string
	controlURL: string
	title: string
}

export interface DlnaPlaybackStatus {
	state: string
	position: number
	duration: number
}
