import type { Span } from '@sentry/react-native'
import {
	type DefaultError,
	type DefinedInitialDataInfiniteOptions,
	type DefinedInitialDataOptions,
	type DefinedUseInfiniteQueryResult,
	type DefinedUseQueryResult,
	type InfiniteData,
	type MutationFunctionContext,
	type QueryClient,
	type QueryFunction,
	type QueryFunctionContext,
	type QueryKey,
	type SkipToken,
	skipToken,
	type UseInfiniteQueryOptions,
	type UseInfiniteQueryResult,
	type UseMutationOptions,
	type UseMutationResult,
	type UseQueryOptions,
	type UseQueryResult,
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
} from '@tanstack/react-query'

import {
	getActiveUiSpan,
	markSpanCancelled,
	markSpanError,
	startSpanOrOperation,
	type TraceAttributes,
} from '@/lib/tracing'

/**
 * 带 Sentry span 的 React Query 封装。
 *
 * 每次 queryFn / mutationFn 执行都会产生一个 span，并通过 context 的 `span` 字段交给调用方，
 * 调用方用 `service.withTrace(span)` / `api.withTrace(span)` 即可把 DB、HTTP span 挂在它下面。
 *
 * parent 的选择：
 * - 正在进行导航、页面加载或用户点击（Sentry 自动创建的 UI idle transaction）→ 作为它的子 span
 * - 否则（后台 refetch、分页、轮询等）→ 单独成为一个 transaction，有自己的 trace
 *
 * 除了 `span` 与 `queryFn` / `mutationFn` 的签名，其余选项与原生 hook 完全一致。
 */

const QUERY_OP = 'query'
const MUTATION_OP = 'mutation'

const MAX_CAUSE_DEPTH = 5

export interface QuerySpanSpec {
	/**
	 * OTel 风格的低基数名字，如 `bilibili.favorite.contents`。
	 * 不要包含 id、搜索词等动态值，需要时放进 `attributes`（注意不要放敏感信息）。
	 */
	name: string
	attributes?: TraceAttributes
}

export interface MutationSpanSpec<TVariables> {
	/** 同 {@link QuerySpanSpec.name} */
	name: string
	attributes?: TraceAttributes
	/** 从 mutation 变量派生属性（同样不要放敏感信息） */
	getAttributes?: (variables: TVariables) => TraceAttributes
}

export type TracedQueryFunctionContext<
	TQueryKey extends QueryKey = QueryKey,
	TPageParam = never,
> = QueryFunctionContext<TQueryKey, TPageParam> & { span: Span }

export type TracedQueryFunction<
	T = unknown,
	TQueryKey extends QueryKey = QueryKey,
	TPageParam = never,
> = (
	context: TracedQueryFunctionContext<TQueryKey, TPageParam>,
) => T | Promise<T>

export type TracedMutationFunctionContext = MutationFunctionContext & {
	span: Span
}

export type TracedMutationFunction<TData = unknown, TVariables = unknown> = (
	variables: TVariables,
	context: TracedMutationFunctionContext,
) => Promise<TData>

type WithTracedQueryFn<
	TOptions,
	TQueryFnData,
	TQueryKey extends QueryKey,
	TPageParam = never,
> = Omit<TOptions, 'queryFn'> & {
	span: QuerySpanSpec
	queryFn: TracedQueryFunction<TQueryFnData, TQueryKey, TPageParam> | SkipToken
}

export type TracedQueryOptions<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
> = WithTracedQueryFn<
	UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
	TQueryFnData,
	TQueryKey
>

export type TracedInfiniteQueryOptions<
	TQueryFnData,
	TError = DefaultError,
	TData = InfiniteData<TQueryFnData>,
	TQueryKey extends QueryKey = QueryKey,
	TPageParam = unknown,
> = WithTracedQueryFn<
	UseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>,
	TQueryFnData,
	TQueryKey,
	TPageParam
>

export type TracedMutationOptions<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TOnMutateResult = unknown,
> = Omit<
	UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
	'mutationFn'
> & {
	span: MutationSpanSpec<TVariables>
	mutationFn: TracedMutationFunction<TData, TVariables>
}

// 请求被中止（组件卸载、手动 cancel）不算失败；中止错误可能被包在 cause 里
function isAbortError(error: Error): boolean {
	let current: Error = error

	for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
		if (current.name === 'AbortError' || current.name === 'CancelledError') {
			return true
		}

		if (!(current.cause instanceof Error)) return false
		current = current.cause
	}

	return false
}

async function runInTracedSpan<T>(
	span: Span,
	fn: () => T | Promise<T>,
): Promise<T> {
	try {
		return await fn()
	} catch (error) {
		const normalized = error instanceof Error ? error : new Error(String(error))

		if (isAbortError(normalized)) {
			markSpanCancelled(span)
		} else {
			markSpanError(span, normalized)
		}

		throw error
	} finally {
		span.end()
	}
}

// 不能读取 context.signal：React Query 用 getter 判断 signal 是否被使用，读取会改变取消行为
function describeQueryFetch(context: {
	client: QueryClient
	queryKey: QueryKey
}): TraceAttributes {
	const state = context.client.getQueryState(context.queryKey)
	const fetchMore = state?.fetchMeta?.fetchMore

	let fetchKind = 'refetch'

	if (fetchMore) {
		fetchKind = 'fetch_more'
	} else if (state?.data === undefined) {
		fetchKind = 'initial'
	}

	return {
		'bbplayer.query.fetch_kind': fetchKind,
		'bbplayer.query.direction': fetchMore?.direction,
		'bbplayer.query.attempt': (state?.fetchFailureCount ?? 0) + 1,
	}
}

function toQueryFn<TQueryFnData, TQueryKey extends QueryKey, TPageParam>(
	spec: QuerySpanSpec,
	queryFn: TracedQueryFunction<TQueryFnData, TQueryKey, TPageParam> | SkipToken,
): QueryFunction<TQueryFnData, TQueryKey, TPageParam> | SkipToken {
	if (queryFn === skipToken) return skipToken

	return (context) => {
		const span = startSpanOrOperation(getActiveUiSpan(), {
			name: spec.name,
			op: QUERY_OP,
			attributes: { ...describeQueryFetch(context), ...spec.attributes },
		})

		// 用 Object.assign 原地追加，避免展开 context 时触发 signal 的 getter
		return runInTracedSpan(span, () =>
			queryFn(Object.assign(context, { span })),
		)
	}
}

/**
 * `queryOptions` 的 traced 版本：把带 span 的选项转换成普通的 query 选项。
 * 主要给 {@link useTracedQueries} 使用，也可用于 `queryClient.fetchQuery` 等命令式 API。
 */
export function tracedQueryOptions<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
>(
	options: TracedQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> {
	const { span, queryFn, ...rest } = options

	return { ...rest, queryFn: toQueryFn(span, queryFn) }
}

/**
 * `useQueries` 本身不做任何包装，每一项都需要用 {@link tracedQueryOptions} 构造，
 * 这样才能保留 `useQueries` 对每一项结果类型的推断。
 */
export const useTracedQueries = useQueries

export function useTracedQuery<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
>(
	options: WithTracedQueryFn<
		DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
		TQueryFnData,
		TQueryKey
	>,
	queryClient?: QueryClient,
): DefinedUseQueryResult<TData, TError>

export function useTracedQuery<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
>(
	options: TracedQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
	queryClient?: QueryClient,
): UseQueryResult<TData, TError>

export function useTracedQuery<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
>(
	options: TracedQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
	queryClient?: QueryClient,
): UseQueryResult<TData, TError> {
	return useQuery(tracedQueryOptions(options), queryClient)
}

export function useTracedInfiniteQuery<
	TQueryFnData,
	TError = DefaultError,
	TData = InfiniteData<TQueryFnData>,
	TQueryKey extends QueryKey = QueryKey,
	TPageParam = unknown,
>(
	options: WithTracedQueryFn<
		DefinedInitialDataInfiniteOptions<
			TQueryFnData,
			TError,
			TData,
			TQueryKey,
			TPageParam
		>,
		TQueryFnData,
		TQueryKey,
		TPageParam
	>,
	queryClient?: QueryClient,
): DefinedUseInfiniteQueryResult<TData, TError>

export function useTracedInfiniteQuery<
	TQueryFnData,
	TError = DefaultError,
	TData = InfiniteData<TQueryFnData>,
	TQueryKey extends QueryKey = QueryKey,
	TPageParam = unknown,
>(
	options: TracedInfiniteQueryOptions<
		TQueryFnData,
		TError,
		TData,
		TQueryKey,
		TPageParam
	>,
	queryClient?: QueryClient,
): UseInfiniteQueryResult<TData, TError>

export function useTracedInfiniteQuery<
	TQueryFnData,
	TError = DefaultError,
	TData = InfiniteData<TQueryFnData>,
	TQueryKey extends QueryKey = QueryKey,
	TPageParam = unknown,
>(
	options: TracedInfiniteQueryOptions<
		TQueryFnData,
		TError,
		TData,
		TQueryKey,
		TPageParam
	>,
	queryClient?: QueryClient,
): UseInfiniteQueryResult<TData, TError> {
	const { span, queryFn, ...rest } = options

	return useInfiniteQuery(
		{ ...rest, queryFn: toQueryFn(span, queryFn) },
		queryClient,
	)
}

export function useTracedMutation<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TOnMutateResult = unknown,
>(
	options: TracedMutationOptions<TData, TError, TVariables, TOnMutateResult>,
	queryClient?: QueryClient,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
	const { span: spec, mutationFn, ...rest } = options

	return useMutation(
		{
			...rest,
			mutationFn: (variables, context) => {
				const span = startSpanOrOperation(getActiveUiSpan(), {
					name: spec.name,
					op: MUTATION_OP,
					attributes: {
						...spec.attributes,
						...spec.getAttributes?.(variables),
					},
				})

				return runInTracedSpan(span, () =>
					mutationFn(variables, Object.assign(context, { span })),
				)
			},
		},
		queryClient,
	)
}
