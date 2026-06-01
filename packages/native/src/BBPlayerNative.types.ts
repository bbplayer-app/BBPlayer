export interface AppUpdateDownloadOptions {
	url: string
	fileName?: string
	title?: string
	description?: string
}

export interface AppUpdateInstallResult {
	downloadId: number
	uri: string
}

export interface SvgaToGifOptions {
	inputUri: string
	outputUri: string
	width?: number
	height?: number
}

export interface SvgaToGifResult {
	uri: string
	width: number
	height: number
	frames: number
	fps: number
}

export interface UnzipOptions {
	inputUri: string
	outputUri: string
}

export interface UnzipResult {
	uri: string
	fileCount: number
}
