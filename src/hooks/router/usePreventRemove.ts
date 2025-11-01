import type { EventArg, NavigationAction } from '@react-navigation/native'
import { useNavigation } from 'expo-router'
import { useEffect, useRef } from 'react'

export default function usePreventRemove(
	shouldPrevent: boolean,
	callback: (
		e: EventArg<
			'beforeRemove',
			true,
			{
				action: NavigationAction
			}
		>,
	) => void,
) {
	const navigation = useNavigation()
	const callbackRef = useRef(callback)
	useEffect(() => {
		callbackRef.current = callback
	}, [callback])

	const shouldPreventRef = useRef(shouldPrevent)
	useEffect(() => {
		shouldPreventRef.current = shouldPrevent
	}, [shouldPrevent])

	useEffect(() => {
		const unsubscribe = navigation.addListener('beforeRemove', (e) => {
			if (shouldPreventRef.current) {
				e.preventDefault()
				callbackRef.current?.(e)
			}
		})
		return unsubscribe
	}, [navigation])
}
