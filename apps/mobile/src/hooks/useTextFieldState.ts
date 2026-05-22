import { useNativeState } from '@expo/ui/jetpack-compose'
import { useEffect } from 'react'

export default function useTextFieldState(value?: string) {
	const state = useNativeState(value ?? '')
	const normalizedValue = value ?? ''

	useEffect(() => {
		if (state.value !== normalizedValue) {
			// oxlint-disable-next-line react-compiler/react-compiler -- useNativeState exposes .value as its JS-side update API.
			state.value = normalizedValue
		}
	}, [normalizedValue, state])

	return state
}
