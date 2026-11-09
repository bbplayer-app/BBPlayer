export const isEnabled = false
export const updateId: string | null = null
export const channel: string | null = null
export const createdAt: Date | null = null
export const runtimeVersion: string | null = null
export const isEmergencyLaunch = false
export const isEmbeddedLaunch = true
export const emergencyLaunchReason: string | null = null

export const checkForUpdateAsync = async () => ({
	isAvailable: false,
	isRollBackToEmbedded: false,
	manifest: undefined,
	reason: 'updatesDisabled',
})

export const fetchUpdateAsync = async () => ({
	isNew: false,
	isRollBackToEmbedded: false,
	manifest: undefined,
})

export const reloadAsync = async () => undefined
export const setUpdateRequestHeadersOverride = () => undefined

export const useUpdates = () => ({
	isUpdateAvailable: false,
	isUpdatePending: false,
	isChecking: false,
	isDownloading: false,
	isRestarting: false,
})
