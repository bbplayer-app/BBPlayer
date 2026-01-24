import {
	returnOrThrowAsync,
	wrapResultAsyncFunction,
} from '@/utils/neverthrow-utils'
import { err, ok } from 'neverthrow'

describe('neverthrow-utils', () => {
	describe('returnOrThrowAsync', () => {
		it('应该在 Result 为 Ok 时返回值', async () => {
			const result = ok('success')
			const value = await returnOrThrowAsync(Promise.resolve(result))
			expect(value).toBe('success')
		})

		it('应该在 Result 为 Err 时抛出错误', async () => {
			const error = new Error('test error')
			const result = err(error)
			await expect(returnOrThrowAsync(Promise.resolve(result))).rejects.toBe(
				error,
			)
		})

		it('应该在值为 undefined 时抛出错误', async () => {
			const result = ok(undefined)
			await expect(returnOrThrowAsync(Promise.resolve(result))).rejects.toThrow(
				'Result is undefined',
			)
		})

		it('应该在值为 null 时抛出错误', async () => {
			const result = ok(null)
			await expect(returnOrThrowAsync(Promise.resolve(result))).rejects.toThrow(
				'Result is undefined',
			)
		})

		it('应该正确处理对象值', async () => {
			const data = { name: 'test', value: 123 }
			const result = ok(data)
			const value = await returnOrThrowAsync(Promise.resolve(result))
			expect(value).toEqual(data)
		})

		it('应该正确处理数组值', async () => {
			const data = [1, 2, 3]
			const result = ok(data)
			const value = await returnOrThrowAsync(Promise.resolve(result))
			expect(value).toEqual(data)
		})
	})

	describe('wrapResultAsyncFunction', () => {
		it('应该正确包装返回 Ok 的异步函数', async () => {
			const asyncFunc = (x: number) => Promise.resolve(ok(x * 2))
			const wrapped = wrapResultAsyncFunction(asyncFunc)

			const result = await wrapped(5)
			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toBe(10)
			}
		})

		it('应该正确包装返回 Err 的异步函数', async () => {
			const error = new Error('wrapped error')
			const asyncFunc = (_x: number) => Promise.resolve(err(error))
			const wrapped = wrapResultAsyncFunction(asyncFunc)

			const result = await wrapped(5)
			expect(result.isErr()).toBe(true)
			if (result.isErr()) {
				expect(result.error).toBe(error)
			}
		})

		it('应该正确传递多个参数', async () => {
			const asyncFunc = (a: number, b: string, c: boolean) =>
				Promise.resolve(ok({ a, b, c }))
			const wrapped = wrapResultAsyncFunction(asyncFunc)

			const result = await wrapped(1, 'test', true)
			expect(result.isOk()).toBe(true)
			if (result.isOk()) {
				expect(result.value).toEqual({ a: 1, b: 'test', c: true })
			}
		})

		it('应该返回 ResultAsync 类型', () => {
			const asyncFunc = () => Promise.resolve(ok('value'))
			const wrapped = wrapResultAsyncFunction(asyncFunc)
			const result = wrapped()

			// ResultAsync 应该有 map, andThen 等方法
			expect(typeof result.map).toBe('function')
			expect(typeof result.andThen).toBe('function')
		})
	})
})
