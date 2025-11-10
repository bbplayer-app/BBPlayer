import type { ResultAsync } from 'neverthrow'
import { fromAsyncThrowable, type Result } from 'neverthrow'

/**
 * 运行 ResultAsync 并返回 Ok 或抛出错误（注意，当返回内容为 undefined 时也会抛出错误）
 * @param resultAsync The ResultAsync instance from the API call.
 * @returns Promise<T> which resolves with value T or rejects with error E.
 */
export async function returnOrThrowAsync<T, E>(
	resultAsync: ResultAsync<T, E> | Promise<Result<T, E>>,
): Promise<Exclude<T, undefined | null>> {
	const result = await resultAsync
	if (result.isOk()) {
		const value = result.value
		if (value === undefined || value === null) {
			throw new Error('Result is undefined')
		}
		return value as Exclude<T, undefined | null>
	}
	// eslint-disable-next-line @typescript-eslint/only-throw-error
	throw result.error
}

/**
 * 将一个 Promise<Result<T, E>> 转换为 ResultAsync<T, E>
 */
export const fromPromiseResult =
	<T, E, Args extends unknown[]>(
		fn: (...args: Args) => Promise<Result<T, E>>, // 👈 直接用这！
	) =>
	(...args: Args): ResultAsync<T, E> =>
		fromAsyncThrowable(fn, (e) => e as E)(...args).andThen((x) => x)
