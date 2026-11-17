import { getMillisSinceProcessStart } from '@bbplayer/native'
import * as Sentry from '@sentry/react-native'
import AppMetrics from 'expo-app-metrics'
import { startProfiling, stopProfiling } from 'react-native-release-profiler'

import {
	getExpoLaunchSource,
	isSentryTelemetryEnabled,
} from '@/lib/config/sentry'
import {
	STARTUP_PROFILING_KEY,
	startupProfilingStarted,
} from '@/lib/startupProfiling'
import { endStartupPhase, flushStartupPhases } from '@/lib/startupTrace'
import { storage } from '@/utils/mmkv'

export const PROFILING_DURATION_MS = 10_000

/** 启动图迟迟不消失（如视频卡住）时，最多等这么久再汇总上报指标 */
const SPLASH_HIDDEN_TIMEOUT_MS = 10_000

/** 首屏迟迟没有可交互（如停在迁移出错页）时，最多等这么久再执行启动后任务 */
const STARTUP_TASKS_TIMEOUT_MS = 5_000

export interface StartupMetrics {
	coldLaunchTime: number | null
	warmLaunchTime: number | null
	bundleLoadTime: number | null
	timeToFirstRender: number | null
	timeToInteractive: number | null
	/** markLoaded → 启动图淡出完成，与 TTFR / TTI 同一起点；仅冷启动有值 */
	splashHiddenTime: number | null
	profilerTracePath: string | null
}

const noMetrics: StartupMetrics = {
	coldLaunchTime: null,
	warmLaunchTime: null,
	bundleLoadTime: null,
	timeToFirstRender: null,
	timeToInteractive: null,
	splashHiddenTime: null,
	profilerTracePath: null,
}

let metrics: StartupMetrics = { ...noMetrics }
let fetched = false
let startupProfilingActive = startupProfilingStarted
let profilingActive = startupProfilingStarted
let interactivePromise: Promise<void> | null = null
let markedInteractive = false
let splashHiddenSinceProcessStart: number | null = null
let resolveSplashHidden: (() => void) | null = null

const splashHiddenPromise = new Promise<void>((resolve) => {
	resolveSplashHidden = resolve
})

let resolveStartupInteractive: (() => void) | null = null

const startupInteractivePromise = new Promise<void>((resolve) => {
	resolveStartupInteractive = resolve
	setTimeout(resolve, STARTUP_TASKS_TIMEOUT_MS)
})

const listeners = new Set<() => void>()

export function subscribeToMetrics(fn: () => void) {
	listeners.add(fn)

	return () => {
		listeners.delete(fn)
	}
}

function emit() {
	listeners.forEach((fn) => fn())
	persistMetrics()
}

export function getMetrics(): Readonly<StartupMetrics> {
	return metrics
}

export function isStartupProfilingEnabled(): boolean {
	return storage.getBoolean(STARTUP_PROFILING_KEY) ?? false
}

export function setStartupProfilingEnabled(enabled: boolean): void {
	storage.set(STARTUP_PROFILING_KEY, enabled)
}

export const SHAKE_PROFILING_KEY = 'enable_shake_profiling'

export function isShakeProfilingEnabled(): boolean {
	return storage.getBoolean(SHAKE_PROFILING_KEY) ?? false
}

export function setShakeProfilingEnabled(enabled: boolean): void {
	storage.set(SHAKE_PROFILING_KEY, enabled)
}

export async function captureProfiling(
	durationMs = PROFILING_DURATION_MS,
): Promise<string | null> {
	if (profilingActive) return null

	try {
		profilingActive = startProfiling()

		if (!profilingActive) return null

		await new Promise((resolve) => setTimeout(resolve, durationMs))
		metrics.profilerTracePath = await stopProfiling(true)
		emit()

		return metrics.profilerTracePath
	} catch {
		return null
	} finally {
		profilingActive = false
	}
}

function persistMetrics() {
	const summary = {
		coldLaunchTime: metrics.coldLaunchTime,
		warmLaunchTime: metrics.warmLaunchTime,
		bundleLoadTime: metrics.bundleLoadTime,
		timeToFirstRender: metrics.timeToFirstRender,
		timeToInteractive: metrics.timeToInteractive,
		splashHiddenTime: metrics.splashHiddenTime,
	}

	// oxlint-disable-next-line no-console
	console.log(`__PERF_METRICS__${JSON.stringify(summary)}__PERF_END__`)
}

function reportStartupMetrics() {
	if (!isSentryTelemetryEnabled()) return

	const attributes = { launch_source: getExpoLaunchSource() }
	const launchTime = metrics.coldLaunchTime ?? metrics.warmLaunchTime

	if (launchTime !== null) {
		Sentry.metrics.distribution('app.startup.duration', launchTime, {
			unit: 'millisecond',
			attributes: {
				...attributes,
				launch_type: metrics.coldLaunchTime !== null ? 'cold' : 'warm',
			},
		})
	}

	if (metrics.bundleLoadTime !== null) {
		Sentry.metrics.distribution(
			'app.startup.bundle_load',
			metrics.bundleLoadTime,
			{ unit: 'millisecond', attributes },
		)
	}

	if (metrics.timeToFirstRender !== null) {
		Sentry.metrics.distribution(
			'app.startup.time_to_first_render',
			metrics.timeToFirstRender,
			{ unit: 'millisecond', attributes },
		)
	}

	if (metrics.timeToInteractive !== null) {
		Sentry.metrics.distribution(
			'app.startup.time_to_interactive',
			metrics.timeToInteractive,
			{ unit: 'millisecond', attributes },
		)
	}

	if (metrics.splashHiddenTime !== null) {
		Sentry.metrics.distribution(
			'app.startup.splash_hidden',
			metrics.splashHiddenTime,
			{ unit: 'millisecond', attributes },
		)
	}
}

async function fetchStartupMetrics(): Promise<void> {
	if (fetched) return

	try {
		const session = AppMetrics.getMainSession()

		for (let attempt = 0; attempt < 20; attempt++) {
			const entries = await session.getMetrics()

			for (const entry of entries) {
				const ms = entry.value * 1000

				switch (entry.name) {
					case 'coldLaunchTime':
						metrics.coldLaunchTime = ms
						break
					case 'warmLaunchTime':
						metrics.warmLaunchTime = ms
						break
					case 'bundleLoadTime':
						metrics.bundleLoadTime = ms
						break
					case 'timeToFirstRender':
						metrics.timeToFirstRender = ms
						break
					case 'timeToInteractive':
						metrics.timeToInteractive = ms
						break
				}
			}

			// 原生侧 markInteractive 后异步持久化，TTI 可能尚未写入，重试
			if (metrics.timeToInteractive !== null) break
			await new Promise((resolve) => setTimeout(resolve, 250))
		}

		fetched = true
	} catch {
		// metrics unavailable in this build
	}
}

async function finishStartupMetrics(): Promise<void> {
	// app start span 以「可交互」为终点，先结算，避免被下面的 profiling / 重试拉长
	if (isSentryTelemetryEnabled()) {
		Sentry.appLoaded()
	}

	if (startupProfilingActive) {
		try {
			await new Promise((resolve) => setTimeout(resolve, 3000))
			metrics.profilerTracePath = await stopProfiling(true)
		} catch {
			// profiling may already be stopped or not supported in this build
		} finally {
			startupProfilingActive = false
			profilingActive = false
		}
	}

	await fetchStartupMetrics()
	await waitForSplashHidden()
	emit()
	reportStartupMetrics()
}

async function waitForSplashHidden(): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined

	await Promise.race([
		splashHiddenPromise,
		new Promise<void>((resolve) => {
			timer = setTimeout(resolve, SPLASH_HIDDEN_TIMEOUT_MS)
		}),
	])
	clearTimeout(timer)

	// 进程启动 → markLoaded 即 coldLaunchTime；温启动时进程早已存在，换算不出有意义的值
	if (
		splashHiddenSinceProcessStart !== null &&
		metrics.coldLaunchTime !== null
	) {
		metrics.splashHiddenTime =
			splashHiddenSinceProcessStart - metrics.coldLaunchTime
	}
}

/**
 * 启动图淡出完成、用户真正看到内容时调用，只记录第一次。
 */
export function markPerfSplashHidden(): void {
	if (splashHiddenSinceProcessStart !== null) return

	try {
		splashHiddenSinceProcessStart = getMillisSinceProcessStart()
	} catch {
		// native module unavailable in this build
	}

	resolveSplashHidden?.()
}

/**
 * 首个页面可交互后，在 JS 线程空闲时执行 task。用于把不影响首屏的启动任务（更新检查、清理、上报等）
 * 挪到首屏之后，避免和首屏挂载抢 JS 线程。启动完成后再调用会直接排到下一次空闲。
 */
export function runAfterStartup(task: () => void): void {
	void startupInteractivePromise.then(() => {
		requestIdleCallback(task, { timeout: 1_000 })
	})
}

export function markPerfInteractive(): Promise<void> {
	// 只记第一个可交互的页面，作为本地性能页展示的启动 TTI
	if (!markedInteractive) {
		markedInteractive = true
		AppMetrics.markInteractive()
		endStartupPhase('app.startup.first_screen')
		flushStartupPhases()
	}

	resolveStartupInteractive?.()

	if (!interactivePromise) {
		interactivePromise = finishStartupMetrics().finally(() => {
			interactivePromise = null
		})
	}

	return interactivePromise
}
