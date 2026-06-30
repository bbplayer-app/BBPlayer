import type { LegendListRef } from '@legendapp/list/react-native'
import type { RefObject } from 'react'
import { useCallback, useRef } from 'react'
import type { GestureResponderEvent } from 'react-native'

export function useDoubleTapScrollToTop(
	passedRef?: RefObject<LegendListRef | null>,
) {
	const localRef = useRef<LegendListRef>(null)
	const listRef = passedRef ?? localRef

	const lastTapRef = useRef<number>(0)

	const handleDoubleTap = useCallback(
		async (_e: GestureResponderEvent) => {
			const now = Date.now()
			const DOUBLE_TAP_DELAY = 300
			if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
				await listRef.current?.scrollToOffset({ offset: 0, animated: true })
				lastTapRef.current = 0
			} else {
				lastTapRef.current = now
			}
		},
		[listRef],
	)

	return {
		listRef,
		handleDoubleTap,
	}
}
