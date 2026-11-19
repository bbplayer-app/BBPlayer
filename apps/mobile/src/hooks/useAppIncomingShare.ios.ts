import type { UseIncomingShareResult } from 'expo-sharing'

const noop = () => undefined

const emptyResult: UseIncomingShareResult = {
	sharedPayloads: [],
	resolvedSharedPayloads: [],
	clearSharedPayloads: noop,
	isResolving: false,
	error: null,
	refreshSharePayloads: noop,
}

/**
 * expo-sharing throws during render on iOS when the app has no App Group, and the
 * iOS build has no share extension, so there is never incoming content to read.
 */
export function useAppIncomingShare(): UseIncomingShareResult {
	return emptyResult
}
