import { useEffect, useState } from 'react'

/**
 * value 保持不变满 delayMs 后才返回它，在那之前返回 undefined。
 *
 * 和 useDebouncedValue 不同：value 一变就立刻返回 undefined，不会先沿用旧值，
 * 刚挂载时也要先等满 delayMs。适合「状态稳定了才显示」的界面。
 * value 按 Object.is 比较，应当传字符串、数字这类按值比较的类型。
 */
export function useSettledValue<T>(value: T, delayMs = 300): T | undefined {
	const [settled, setSettled] = useState<{ value: T }>()

	useEffect(() => {
		const timer = setTimeout(() => setSettled({ value }), delayMs)

		return () => clearTimeout(timer)
	}, [value, delayMs])

	return settled !== undefined && Object.is(settled.value, value)
		? value
		: undefined
}
