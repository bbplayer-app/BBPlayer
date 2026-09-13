export type PlayerMode = 'music' | 'podcast'

/** The app-owned context for one continuous playback session. */
export interface PlaybackContext {
	sessionId: string
	mode: PlayerMode
}

export interface PlaybackContextState {
	context: PlaybackContext | null
	ready: boolean
}

export function parsePlaybackContextState(
	value: unknown,
): PlaybackContextState {
	const context =
		value && typeof value === 'object' && 'context' in value
			? value.context
			: null
	if (
		context &&
		typeof context === 'object' &&
		'sessionId' in context &&
		typeof context.sessionId === 'string' &&
		context.sessionId.length > 0 &&
		'mode' in context &&
		(context.mode === 'music' || context.mode === 'podcast')
	) {
		return {
			context: { sessionId: context.sessionId, mode: context.mode },
			// Native queue restoration must complete before exposing the saved mode.
			ready: false,
		}
	}
	return { context: null, ready: false }
}
