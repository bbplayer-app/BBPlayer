import { useEffect, useState } from 'react'

/**
 * value 保持不变满 delayMs 后才返回它，在那之前返回 undefined。
 *
 * 和 useDebouncedValue 不同：value 一变就立刻返回 undefined，不会先沿用旧值，
 * 刚挂载时也要先等满 delayMs。变回之前已经稳定过的值也算新的一段，同样要重新等满。
 * 适合「状态稳定了才显示」的界面。
 * value 按 Object.is 比较，应当传字符串、数字这类按值比较的类型。
 */
export function useSettledValue<T>(value: T, delayMs = 300): T | undefined {
	// value 每变一次就换一个新对象，代表一段新的「连续不变」区间。
	// 只比较值的话，A → B → A 时会认出之前已经稳定过的 A，不等就直接返回
	const [run, setRun] = useState(() => ({ value }))

	if (!Object.is(run.value, value)) {
		setRun({ value })
	}

	const [settledRun, setSettledRun] = useState<{ value: T }>()

	useEffect(() => {
		const timer = setTimeout(() => setSettledRun(run), delayMs)

		return () => clearTimeout(timer)
	}, [run, delayMs])

	return settledRun === run && Object.is(run.value, value) ? value : undefined
}
