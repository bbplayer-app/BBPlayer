import type { ObservableState } from '../hooks/useNativeState'

import getStateId from './getStateId'

export type NativeObservableStateReference = { stateId: number }

export function isObservableState<T>(
	value: unknown,
): value is ObservableState<T> {
	return getStateId(value as object | null | undefined) != null
}

/**
 * We passed `__expo_shared_object_id__` as a object to component's props,
 * so that native side can recognize it and cast to SharedObject correctly.
 *
 * Native side codes please see `ObservableStateHandle.kt`.
 */
export default function serializeObservableState(
	state: ObservableState<unknown> | undefined,
): NativeObservableStateReference {
	const id = getStateId(state)
	if (id == null) {
		throw new Error(
			'Expected an ObservableState with a native SharedObject id.',
		)
	}
	return { stateId: id }
}
