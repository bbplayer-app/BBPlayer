import { useCallback, useRef } from 'react'

export function useDeferredSheetAction() {
	const pendingAction = useRef<(() => void) | null>(null)

	const deferAction = useCallback((action: () => void) => {
		pendingAction.current = action
	}, [])

	const runPendingAction = useCallback(() => {
		const action = pendingAction.current
		pendingAction.current = null
		action?.()
	}, [])

	return { deferAction, runPendingAction }
}
