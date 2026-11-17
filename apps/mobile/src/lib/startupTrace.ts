import * as Sentry from '@sentry/react-native'

import { getActiveUiSpan } from '@/lib/tracing'

/**
 * 冷启动各阶段的 span，挂到 SDK 自动创建的 app start transaction（op 为 ui.load）下面，
 * 用来拆开「JS bundle 执行完」到「第一个页面可交互」之间的时间。
 *
 * 这个 transaction 要等导航容器注册后才会创建，比 RootLayout 的 effect 晚，所以执行时只记时间戳，
 * 等第一个页面可交互时再按原来的时间补记成 span。只记录本次 JS 运行时的第一次启动。
 */

export type StartupPhase =
	| 'app.startup.root_mount'
	| 'app.startup.init'
	| 'app.startup.db_migrate'
	| 'app.startup.first_screen'

interface PhaseRecord {
	name: StartupPhase
	start: number
	end: number
}

const phases: PhaseRecord[] = []
const pending = new Map<StartupPhase, number>()

/** 重新渲染、重新挂载时不再重复记录 */
const started = new Set<StartupPhase>()
let flushed = false

export function startStartupPhase(name: StartupPhase): void {
	if (flushed || started.has(name)) return
	started.add(name)
	pending.set(name, Date.now())
}

export function endStartupPhase(name: StartupPhase): void {
	const start = pending.get(name)

	if (flushed || start === undefined) return
	pending.delete(name)
	phases.push({ name, start, end: Date.now() })
}

export function measureStartupPhase<T>(name: StartupPhase, fn: () => T): T {
	startStartupPhase(name)

	try {
		return fn()
	} finally {
		endStartupPhase(name)
	}
}

/** 首次可交互时补记；SDK 在处理事件时才把首个 navigation transaction 改为 ui.load。 */
export function flushStartupPhases(): void {
	if (flushed) return
	flushed = true

	const parent = getActiveUiSpan()

	if (!parent) return
	const op = Sentry.spanToJSON(parent).op

	if (op !== 'navigation' && op !== 'ui.load') return

	for (const phase of phases) {
		Sentry.startInactiveSpan({
			name: phase.name,
			op: 'app.startup',
			parentSpan: parent,
			startTime: phase.start,
		}).end(phase.end)
	}
}
