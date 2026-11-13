import * as Sentry from '@sentry/react-native'
import type { Span } from '@sentry/react-native'
import { ResultAsync } from 'neverthrow'

import { CustomError } from '@/lib/errors'

/**
 * Sentry 链路追踪的统一入口。
 *
 * 为什么不直接用 `Sentry.startSpan` 的隐式嵌套：
 * 1. Hermes 没有 AsyncLocalStorage，Sentry 在 RN 上用的是一个全局 scope 栈。
 *    `startSpan(cb)` 只在回调的同步部分保证 active span 正确；跨 await 之后上下文不可靠，
 *    子 span 可能丢失 parent，也可能挂到当时恰好 active 的其他流程的 span 上。
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

export type DbOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * 按 OTel 数据库语义约定构造 DB span：
 * - span 名 = `db.query.summary` = `{operation} {collection...}`，低基数，便于在 Sentry 中按表 / 操作聚合
 * - 只涉及一张表时才记录 `db.collection.name`（多表 join 不记录）
 * - `queryName` 标识具体是哪条查询（同一张表上可能有多种查询），记在应用自定义属性里
 */
export function dbSpan(
	operation: DbOperation,
	collections: string | readonly string[],
	queryName: string,
): TraceSpec {
	const collectionList = Array.isArray(collections)
		? collections
		: [collections]

	const summary = [operation, ...collectionList].join(' ')

	return {
		name: summary,
		op: 'db',
		attributes: {
			'db.system.name': 'sqlite',
			'db.operation.name': operation,
			'db.query.summary': summary,
			'db.collection.name':
				collectionList.length === 1 ? collectionList[0] : undefined,
			'bbplayer.db.query_name': queryName,
		},
	}
}

function toStartOptions(spec: TraceSpec) {
	return {
		name: spec.name,
		op: spec.op,
		attributes: spec.attributes,
	}
}

function setSpanError(span: Span, type: string): void {
	span.setStatus({ code: SPAN_STATUS_ERROR, message: type })
	span.setAttribute('error.type', type)
}

/**
 * 错误 → 最先记录它的 span（即最内层失败的 span）。
 * 我们的 span 不进入全局 scope，上报错误时 Sentry 拿不到 trace 上下文，
 * 由 `findErrorSpan` 在 beforeSend 中反查，把 issue 关联回对应的 trace。
 */
const errorSpans = new WeakMap<Error, Span>()

const MAX_CAUSE_DEPTH = 5

/** 把错误记录到 span 上：状态置为 error，并附带错误类型 */
export function markSpanError(span: TraceParent, error: Error): void {
	if (!span) return

	setSpanError(
		span,
		error instanceof CustomError && error.type ? error.type : error.name,
	)

	if (!errorSpans.has(error)) {
		errorSpans.set(error, span)
	}
}

/** 把 span 标记为已取消（如组件卸载导致请求中止），不计为失败 */
export function markSpanCancelled(span: Span): void {
	span.setStatus({ code: SPAN_STATUS_ERROR, message: 'cancelled' })
	span.setAttribute('bbplayer.cancelled', true)
}

/** 把 span 标记为超时失败 */
export function markSpanTimeout(span: Span): void {
	setSpanError(span, 'deadline_exceeded')
}

/** 查找错误（或其 cause 链上的错误）失败时所在的 span */
export function findErrorSpan(error: Error): Span | undefined {
	let current: Error = error

	for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
		const span = errorSpans.get(current)

		if (span) return span

		if (!(current.cause instanceof Error)) return undefined
		current = current.cause
	}

	return undefined
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
 * 创建一个业务根 span（transaction）。
 *
 * 当前有进行中的 UI root（导航 / 点击）时，作为它的子 span 挂在同一条 trace 下，
 * 这样「点击 → 业务」在 Sentry 里是一棵树；没有 UI root 时才开启新的 trace。
 *
 * 注意不能在这里用 `forceTransaction`：子事务不会被算作父 span 的 descendant，
 * 父事务仍会被 SDK 以「no child spans」为由丢弃，树就断了。
 *
 * 适合事件驱动、无法用回调包裹的流程；调用方负责 `end()`。
 */
export function startOperation(spec: TraceSpec): Span {
	const uiParent = getActiveUiSpan()

	if (uiParent) {
		return Sentry.startInactiveSpan({
			...toStartOptions(spec),
			parentSpan: uiParent,
		})
	}

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

/**
 * 在一个业务 span 中执行 fn，fn 拿到的 span 用作后续步骤的 parent。
 * 默认开启新的 trace（transaction）；传入 `parent` 时作为它的子 span（如由 query / mutation 触发）。
 */
export function traceOperation<T>(
	spec: TraceSpec,
	fn: (span: Span) => PromiseLike<T>,
	parent?: TraceParent,
): Promise<T> {
	return runInSpan(startSpanOrOperation(parent, spec), fn)
}

/** `traceOperation` 的 neverthrow 版本：Err 会把 span 标记为失败 */
export function traceOperationResult<T, E extends Error>(
	spec: TraceSpec,
	fn: (span: Span) => ResultAsync<T, E>,
	parent?: TraceParent,
): ResultAsync<T, E> {
	return runResultInSpan(startSpanOrOperation(parent, spec), fn)
}

/**
 * 当前正在进行的 UI 根 span（导航、页面加载、用户点击产生的 idle transaction）。
 * 这些 span 由 Sentry 自动创建并放在全局 scope 上，生命周期短，期间发起的请求基本都由它触发。
 */
const UI_ROOT_OPS = new Set(['navigation', 'ui.load'])

export function getActiveUiSpan(): Span | undefined {
	const active = Sentry.getActiveSpan()

	if (!active) return undefined

	const root = Sentry.getRootSpan(active)
	const { op, timestamp } = Sentry.spanToJSON(root)

	// timestamp 存在说明已经结束
	if (!op || timestamp !== undefined) return undefined

	return UI_ROOT_OPS.has(op) || op.startsWith('ui.action') ? root : undefined
}

/**
 * 有 parent 时开子 span；没有时开一个新的业务根 span（transaction）。
 * 调用方负责 `end()`。
 */
export function startSpanOrOperation(
	parent: TraceParent,
	spec: TraceSpec,
): Span {
	if (!parent) return startOperation(spec)

	return Sentry.startInactiveSpan({
		...toStartOptions(spec),
		parentSpan: parent,
	})
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
