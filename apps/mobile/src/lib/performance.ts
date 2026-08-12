import performance, { PerformanceObserver } from 'react-native-performance'
import { startProfiling, stopProfiling } from 'react-native-release-profiler'

export interface StartupMetrics {
	/** Total cold start: nativeLaunchStart → contentAppeared (ms) */
	startTime: number | null
	/** JS bundle parse & execution: runJsBundleStart → runJsBundleEnd (ms) */
	bundleLoadTime: number | null
	/** Time to first render: nativeLaunchStart → contentAppeared (ms) */
	timeToRender: number | null
	/** Time to interactive: nativeLaunchStart → tti_mark (ms) */
	timeToInteractive: number | null
	/** Path to the release profiler trace, saved when profiling stops */
	profilerTracePath: string | null
	nativeMarks: Array<{ name: string; startTime: number }>
	customMarks: Array<{ name: string; startTime: number; duration: number }>
}

const noMetrics: StartupMetrics = {
	startTime: null,
	bundleLoadTime: null,
	timeToRender: null,
	timeToInteractive: null,
	profilerTracePath: null,
	nativeMarks: [],
	customMarks: [],
}

let metrics: StartupMetrics = { ...noMetrics }
let initialized = false
const listeners = new Set<() => void>()

export function subscribeToMetrics(fn: () => void) {
	listeners.add(fn)
	return () => {
		listeners.delete(fn)
	}
}

function emit() {
	listeners.forEach((fn) => fn())
}

export function getMetrics(): Readonly<StartupMetrics> {
	return metrics
}

function measure(name: string, start: string, end: string): number | null {
	try {
		performance.measure(name, start, end)
		const entries = performance.getEntriesByName(name, 'measure')
		return entries.length > 0 ? entries[entries.length - 1].duration : null
	} catch {
		return null
	}
}

function hasMark(name: string): boolean {
	return performance.getEntriesByName(name, 'react-native-mark').length > 0
}

function snapNativeMarks() {
	const entries = performance.getEntriesByType(
		'react-native-mark',
	) as PerformanceEntry[]
	metrics.nativeMarks = entries.map((e) => ({
		name: e.name,
		startTime: e.startTime,
	}))
}

function snapCustom() {
	const nativeNames = new Set(metrics.nativeMarks.map((m) => m.name))
	const entries = [
		...performance.getEntriesByType('mark'),
		...performance.getEntriesByType('measure'),
	].filter((e) => !nativeNames.has(e.name)) as PerformanceEntry[]

	metrics.customMarks = entries.map((e) => ({
		name: e.name,
		startTime: e.startTime,
		duration: e.duration,
	}))
}

export async function markInteractive(): Promise<void> {
	if (!hasMark('nativeLaunchStart')) return
	performance.mark('tti_mark')
	metrics.timeToInteractive = measure('tti', 'nativeLaunchStart', 'tti_mark')
	snapCustom()

	try {
		const path = await stopProfiling(true, 'bbplayer-startup-trace')
		metrics.profilerTracePath = path
	} catch {
		// profiling may already be stopped or not supported in this build
	}

	emit()
}

export function initPerformanceObserver(): void {
	if (initialized) return
	initialized = true

	try {
		startProfiling()
	} catch {
		// profiling not available in this build
	}

	let resolved = false

	function compute() {
		if (resolved) return
		if (!hasMark('contentAppeared')) return
		resolved = true

		metrics.startTime = measure('start', 'nativeLaunchStart', 'contentAppeared')
		metrics.bundleLoadTime = measure(
			'bundleLoad',
			'runJsBundleStart',
			'runJsBundleEnd',
		)
		metrics.timeToRender = metrics.startTime

		snapNativeMarks()
		snapCustom()
		emit()
	}

	new PerformanceObserver((_list, _observer) => {
		compute()
	}).observe({ type: 'react-native-mark', buffered: true })
}
