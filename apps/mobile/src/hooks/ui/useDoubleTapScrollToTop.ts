import type { FlashListRef } from '@shopify/flash-list'
import type { RefObject } from 'react'
import { useCallback, useRef } from 'react'
import type { GestureResponderEvent } from 'react-native'

export function useDoubleTapScrollToTop<T>(
	passedRef?: RefObject<FlashListRef<T> | null>,
) {
	const localRef = useRef<FlashListRef<T>>(null)
	const listRef = passedRef ?? localRef

	const lastTapRef = useRef<number>(0)

	const handleDoubleTap = useCallback(
		(_e: GestureResponderEvent) => {
			const now = Date.now()
			const DOUBLE_TAP_DELAY = 300
			if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
				listRef.current?.scrollToOffset({ offset: 0, animated: true })
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
