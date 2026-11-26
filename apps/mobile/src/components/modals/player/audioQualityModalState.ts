/**
 * 切流指示器的延迟阈值：低于该耗时的切换完全不展示 loading，避免快速切换时闪烁。
 */
export const SWITCH_INDICATOR_DELAY_MS = 180

export interface DelayedVisibilityScheduler {
	setTimeout: typeof setTimeout
	clearTimeout: typeof clearTimeout
}

export type DelayedVisibilityTimer = ReturnType<
	DelayedVisibilityScheduler['setTimeout']
>

export interface DelayedVisibilityController {
	start: () => void
	finish: () => void
	dispose: () => void
}

const defaultScheduler: DelayedVisibilityScheduler = {
	setTimeout,
	clearTimeout,
}

/**
 * 创建一个「延迟展示、收尾即隐藏」的可见性控制器。
 *
 * - start：重新计时，超过 delayMs 仍未收尾才回调 true；
 * - finish：清理计时；此前已展示过则回调 false，否则不产生多余回调；
 * - dispose：清理计时并永久失效，之后不再触发任何回调。
 */
export function createDelayedVisibilityController(
	delayMs: number,
	onVisibilityChange: (visible: boolean) => void,
	scheduler: DelayedVisibilityScheduler = defaultScheduler,
): DelayedVisibilityController {
	let timer: DelayedVisibilityTimer | null = null
	let visible = false
	let disposed = false

	const clearTimer = () => {
		if (timer === null) {
			return
		}

		scheduler.clearTimeout(timer)
		timer = null
	}

	const start = () => {
		if (disposed) {
			return
		}

		clearTimer()

		if (visible) {
			return
		}

		timer = scheduler.setTimeout(() => {
			timer = null

			if (disposed) {
				return
			}

			visible = true
			onVisibilityChange(true)
		}, delayMs)
	}

	const finish = () => {
		clearTimer()

		if (disposed || !visible) {
			return
		}

		visible = false
		onVisibilityChange(false)
	}

	const dispose = () => {
		clearTimer()
		disposed = true
		visible = false
	}

	return { start, finish, dispose }
}

export type AudioQualityCardState =
	| 'pending'
	| 'unconfirmed'
	| 'actual'
	| 'loading'
	| 'load_failed'
	| 'idle'

export function resolveAudioQualityCardState(
	hasPending: boolean,
	qualityUnconfirmed: boolean,
	hasActual: boolean,
	qualityLoading: boolean,
	qualityLoadFailed: boolean,
): AudioQualityCardState {
	if (hasPending) {
		return 'pending'
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
