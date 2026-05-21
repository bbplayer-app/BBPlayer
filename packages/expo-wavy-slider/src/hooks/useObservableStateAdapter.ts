import { useEffect } from 'react'
import {
	isSharedValue,
	startMapper,
	stopMapper,
	type SharedValue,
} from 'react-native-reanimated'

import { isObservableState } from '../utils/serializeObservableState'

import useNativeState, { type ObservableState } from './useNativeState'

export type ObservableStateAdapterInput<T> = ObservableState<T> | SharedValue<T>

export function isWavySliderAnimatedValue<T>(
	value: unknown,
): value is ObservableStateAdapterInput<T> {
	return isObservableState<T>(value) || isSharedValue<T>(value)
}

export default function useObservableStateAdapter<T>(
	value: ObservableStateAdapterInput<T> | null | undefined,
	initialValue: T,
): ObservableState<T> | undefined {
	const sharedValueAdapter = useNativeState(initialValue)

	useEffect(() => {
		if (!value || isObservableState<T>(value)) return

		const mapperId = startMapper(() => {
			'worklet'
			// oxlint-disable-next-line react-compiler/react-compiler -- ObservableState is a native shared object; writing .value updates Compose without a React state mutation.
			sharedValueAdapter.value = value.value
		}, [value])

		return () => {
			stopMapper(mapperId)
		}
	}, [sharedValueAdapter, value])

	if (!value) return undefined
	if (isObservableState<T>(value)) return value
	return sharedValueAdapter
}
