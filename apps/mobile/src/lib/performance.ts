import AppMetrics from 'expo-app-metrics'
import { startProfiling, stopProfiling } from 'react-native-release-profiler'

import { storage } from '@/utils/mmkv'

export const PROFILING_DURATION_MS = 10_000

export interface StartupMetrics {
	coldLaunchTime: number | null
	warmLaunchTime: number | null
	bundleLoadTime: number | null
	timeToFirstRender: number | null
	timeToInteractive: number | null
	profilerTracePath: string | null
}

const noMetrics: StartupMetrics = {
	coldLaunchTime: null,
	warmLaunchTime: null,
	bundleLoadTime: null,
	timeToFirstRender: null,
	timeToInteractive: null,
	profilerTracePath: null,
}

let metrics: StartupMetrics = { ...noMetrics }
let fetched = false
let startupProfilingActive = false
let profilingActive = false
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
	return storage.getBoolean('enable_startup_profiling') ?? false
}

export function setStartupProfilingEnabled(enabled: boolean): void {
	storage.set('enable_startup_profiling', enabled)
}

export function isShakeProfilingEnabled(): boolean {
	return storage.getBoolean('enable_shake_profiling') ?? false
}

export function setShakeProfilingEnabled(enabled: boolean): void {
	storage.set('enable_shake_profiling', enabled)
}

export function startStartupProfiling(): void {
	if (!isStartupProfilingEnabled() || profilingActive) return

	try {
		profilingActive = startProfiling()
		startupProfilingActive = profilingActive
	} catch {
		// profiling is unavailable in this build
	}
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
	}
	// oxlint-disable-next-line no-console
	console.log(`__PERF_METRICS__${JSON.stringify(summary)}__PERF_END__`)
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
		emit()
	} catch {
		// metrics unavailable in this build
	}
}

export async function markPerfInteractive(): Promise<void> {
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
}
