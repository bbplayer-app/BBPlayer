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

export interface UnzipOptions {
	inputUri: string
	outputUri: string
}

export interface UnzipResult {
	uri: string
	fileCount: number
}
