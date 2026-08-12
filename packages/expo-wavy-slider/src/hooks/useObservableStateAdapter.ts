import { useEffect } from 'react'
import {
	isSharedValue,
	startMapper,
	stopMapper,
	useSharedValue,
	type SharedValue,
} from 'react-native-reanimated'

import getStateId from '../utils/getStateId'
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
	const sharedValueAdapterId = getStateId(sharedValueAdapter)
	const isActive = useSharedValue(false)

	useEffect(() => {
		if (!value || isObservableState<T>(value)) return undefined
		if (sharedValueAdapterId == null) return undefined

		isActive.set(true)

		const mapperId = startMapper(() => {
			'worklet'
			if (!isActive.value) return

			const nextValue = value.value
			if (nextValue === undefined) return

			const adapter = resolveObservableStateInWorklet(sharedValueAdapterId)
			adapter?.setValue?.({ value: nextValue })
		}, [value, isActive])

		return () => {
			isActive.set(false)
			stopMapper(mapperId)
		}
	}, [sharedValueAdapterId, value, isActive])

	if (!value) return undefined
	if (isObservableState<T>(value)) return value
	return sharedValueAdapter
}

type ObservableStateInWorklet = {
	setValue?: (value: { value: unknown }) => void
}

function resolveObservableStateInWorklet(
	stateId: number,
): ObservableStateInWorklet | undefined {
	'worklet'
	const expo = (
		globalThis as typeof globalThis & {
			expo?: {
				SharedObject?: {
					__resolveInWorklet?: (id: number) => ObservableStateInWorklet
				}
			}
		}
	).expo

	const sharedObject = expo?.SharedObject
	try {
		// oxlint-disable-next-line no-underscore-dangle
		return sharedObject?.__resolveInWorklet?.(stateId)
	} catch {
		return undefined
	}
}
