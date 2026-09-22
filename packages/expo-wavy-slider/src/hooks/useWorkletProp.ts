import { type SharedObject, useReleasingSharedObject } from 'expo-modules-core'
import { useLayoutEffect, useMemo, useRef } from 'react'

import ExpoWavySliderModule from '../ExpoWavySliderModule'
import { worklets } from '../utils/ensureWorklets'

type InstancedSharedObject = InstanceType<typeof SharedObject>

export default function useWorkletProp(
	callback: ((value: number) => void) | ((value: boolean) => void) | undefined,
	propName: string,
): InstancedSharedObject {
	const serializedCallback = useMemo(() => {
		if (!callback) return null
		if (!worklets.isWorkletFunction(callback)) {
			throw new Error(
				`${propName} must be a worklet function. Add the 'worklet' directive as the first statement in your callback.`,
			)
		}
		return worklets.createSerializable(callback)
	}, [callback, propName])
	const initialCallback = useRef(serializedCallback)
	// Keep the ID passed to the native view alive for the entire mount. Releasing
	// replaced callbacks can race with native prop updates that still carry their IDs.
	const sharedCallback = useReleasingSharedObject(
		() => new ExpoWavySliderModule.WorkletCallback(initialCallback.current),
		[],
	)
	useLayoutEffect(() => {
		// Publish only committed renders, including clearing a removed callback.
		sharedCallback.setWorklet(serializedCallback)
	}, [sharedCallback, serializedCallback])
	return sharedCallback
}
