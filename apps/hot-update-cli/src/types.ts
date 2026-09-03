export type CommandArguments = Record<string, string | boolean>

export interface UpdateServerCredentials {
	serverUrl: string
	accessToken: string
}

export interface Fingerprint {
	hash: string
	sources: unknown[]
}
