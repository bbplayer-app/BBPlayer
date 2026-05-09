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
