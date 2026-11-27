export interface DelayedVisibilityScheduler {
	setTimeout: typeof setTimeout
	clearTimeout: typeof clearTimeout
}

export type DelayedVisibilityTimer = ReturnType<
	DelayedVisibilityScheduler['setTimeout']
>

const defaultScheduler: DelayedVisibilityScheduler = {
	setTimeout,
	clearTimeout,
}

export type AudioQualityCardState =
	| 'pending'
	| 'checking'
	| 'unconfirmed'
	| 'actual'
	| 'loading'
	| 'load_failed'
	| 'idle'

export function resolveAudioQualityCardState(
	hasPending: boolean,
	isChecking: boolean,
	qualityUnconfirmed: boolean,
	hasActual: boolean,
	qualityLoading: boolean,
	qualityLoadFailed: boolean,
): AudioQualityCardState {
	if (hasPending) {
		return 'pending'
	}

	if (isChecking) {
		return 'checking'
	}

	if (qualityUnconfirmed) {
		return 'unconfirmed'
	}

	if (hasActual) {
		return 'actual'
	}

	if (qualityLoading) {
		return 'loading'
	}

	if (qualityLoadFailed) {
		return 'load_failed'
	}

	return 'idle'
}

export interface PendingSwitchTimer {
	start: () => void
	settle: () => void
	dispose: () => void
}

export function createPendingSwitchTimer(
	delayMs: number,
	onTimeout: () => void,
	scheduler: DelayedVisibilityScheduler = defaultScheduler,
): PendingSwitchTimer {
	let timer: DelayedVisibilityTimer | null = null
	let disposed = false

	const clear = () => {
		if (timer === null) {
			return
		}

		scheduler.clearTimeout(timer)
		timer = null
	}

	const start = () => {
		if (disposed || timer !== null) {
			return
		}

		timer = scheduler.setTimeout(() => {
			timer = null

			if (!disposed) {
				onTimeout()
			}
		}, delayMs)
	}

	const settle = () => {
		clear()
	}

	const dispose = () => {
		clear()
		disposed = true
	}

	return { start, settle, dispose }
}

export function withQualityTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	const timeout = new Promise<never>((_resolve, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error('读取音质超时'))
		}, timeoutMs)
	})

	return Promise.race([promise, timeout]).finally(() => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId)
		}
	})
}
