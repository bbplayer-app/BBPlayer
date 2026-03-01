import { useCallback, useState } from 'react'

import usePreventRemove from '@/hooks/router/usePreventRemove'

export function useTrackSelection<T = number>() {
	const [selected, setSelected] = useState<Set<T>>(() => new Set())
	const [selectMode, setSelectMode] = useState<boolean>(false)

	const toggle = useCallback((id: T) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}, [])

	const enterSelectMode = useCallback((id?: T) => {
		setSelectMode(true)
		if (id !== undefined) {
			setSelected(new Set([id]))
		}
	}, [])

	const exitSelectMode = useCallback(() => {
		setSelectMode(false)
		setSelected(new Set())
	}, [])

	usePreventRemove(selectMode, () => {
		exitSelectMode()
	})

	return {
		selected,
		selectMode,
		toggle,
		enterSelectMode,
		exitSelectMode,
		setSelectMode,
		setSelected,
	}
}
