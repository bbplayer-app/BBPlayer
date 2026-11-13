import * as Sentry from '@sentry/react-native'
import type { Span } from '@sentry/react-native'
import { ResultAsync } from 'neverthrow'

import { CustomError } from '@/lib/errors'

/**
 * Sentry 链路追踪的统一入口。
 *
 * 为什么不直接用 `Sentry.startSpan` 的隐式嵌套：
 * 1. Hermes 没有 AsyncLocalStorage，Sentry 在 RN 上用的是一个全局 scope 栈。
 *    一个 span 跨 await 处于 active 状态时，同时在跑的其他异步任务也会把它当成 parent，
 *    并发任务之间的 span 会互相串台。
 * 2. RN SDK 默认开启 `parentSpanIsAlwaysRootSpan`，隐式 parent 一律被拍平到 root span 上，
 *    trace 里看不到层级。
 *
 * 所以这里的 span 都不进入全局 scope，而是显式传递 parent：
 * - `traceOperation` / `traceOperationResult`：开启一个独立 trace 的业务根 span（transaction）。
 * - `traceSpan` / `traceResult`：在给定 parent 下开子 span；parent 为空时直接执行，不产生 span。
 */

export type TraceParent = Span | undefined

export interface TraceAttributes {
	[key: string]: string | number | boolean | undefined
}

export interface TraceSpec {
	name: string
	op: string
	attributes?: TraceAttributes
}

const SPAN_STATUS_ERROR = 2

function randomHex(length: number): string {
	let out = ''

	for (let i = 0; i < length; i++) {
		out += Math.floor(Math.random() * 16).toString(16)
	}

	return out
}

// 把 'db:query:playlist' 这类名字拆成 OTel 语义属性，便于在 Sentry 中按表 / 操作聚合
function deriveAttributes(spec: TraceSpec): TraceAttributes {
	if (spec.op !== 'db') {
		return {}
	}

	const [, operation, ...rest] = spec.name.split(':')

	return {
		'db.system.name': 'sqlite',
		'db.operation.name': operation,
		'db.collection.name': rest.at(-1),
	}
}

function toStartOptions(spec: TraceSpec) {
	return {
		name: spec.name,
		op: spec.op,
		attributes: { ...deriveAttributes(spec), ...spec.attributes },
	}
}

function setSpanError(span: Span, type: string): void {
	span.setStatus({ code: SPAN_STATUS_ERROR, message: type })
	span.setAttribute('error.type', type)
}

/** 把错误记录到 span 上：状态置为 error，并附带错误类型 */
export function markSpanError(span: TraceParent, error: Error): void {
	if (!span) return

	setSpanError(
		span,
		error instanceof CustomError && error.type ? error.type : error.name,
	)
}

async function runInSpan<T>(
	span: Span,
	fn: (span: Span) => PromiseLike<T>,
): Promise<T> {
	try {
		return await fn(span)
	} catch (error) {
		if (error instanceof Error) {
			markSpanError(span, error)
		} else {
			setSpanError(span, 'internal_error')
		}

		throw error
	} finally {
		span.end()
	}
}

// neverthrow 的 Err 不会抛异常，需要单独识别才能让 span 反映失败
function runResultInSpan<T, E extends Error>(
	span: Span,
	fn: (span: Span) => ResultAsync<T, E>,
): ResultAsync<T, E> {
	return new ResultAsync(
		runInSpan(span, async (s) => {
			const result = await fn(s)

			if (result.isErr()) {
				markSpanError(s, result.error)
			}

			return result
		}),
	)
}

/**
 * 创建一个业务根 span（transaction），并开启新的 trace。
 * 适合事件驱动、无法用回调包裹的流程；调用方负责 `end()`。
 */
export function startOperation(spec: TraceSpec): Span {
	const scope = Sentry.getCurrentScope().clone()
	scope.setPropagationContext({
		traceId: randomHex(32),
		sampleRand: Math.random(),
	})

	return Sentry.startInactiveSpan({
		...toStartOptions(spec),
		scope,
		parentSpan: null,
		forceTransaction: true,
	})
}

/** 在一个新的业务根 span（transaction）中执行 fn，fn 拿到的 span 用作后续步骤的 parent */
export function traceOperation<T>(
	spec: TraceSpec,
	fn: (span: Span) => PromiseLike<T>,
): Promise<T> {
	return runInSpan(startOperation(spec), fn)
}

/** `traceOperation` 的 neverthrow 版本：Err 会把 span 标记为失败 */
export function traceOperationResult<T, E extends Error>(
	spec: TraceSpec,
	fn: (span: Span) => ResultAsync<T, E>,
): ResultAsync<T, E> {
	return runResultInSpan(startOperation(spec), fn)
}

/**
 * 在 parent 下开一个子 span 执行 fn。
 * parent 为空（不在任何业务流程里）时直接执行 fn，不产生孤儿 transaction。
 */
export async function traceSpan<T>(
	parent: TraceParent,
	spec: TraceSpec,
	fn: (span: TraceParent) => PromiseLike<T>,
): Promise<T> {
	if (!parent) {
		return await fn(undefined)
	}

	const span = Sentry.startInactiveSpan({
		...toStartOptions(spec),
		parentSpan: parent,
	})

	return runInSpan(span, fn)
}

/** `traceSpan` 的 neverthrow 版本：Err 会把 span 标记为失败 */
export function traceResult<T, E extends Error>(
	parent: TraceParent,
	spec: TraceSpec,
	fn: (span: TraceParent) => ResultAsync<T, E>,
): ResultAsync<T, E> {
	if (!parent) {
		return fn(undefined)
	}

	const span = Sentry.startInactiveSpan({
		...toStartOptions(spec),
		parentSpan: parent,
	})

	return runResultInSpan(span, fn)
}
