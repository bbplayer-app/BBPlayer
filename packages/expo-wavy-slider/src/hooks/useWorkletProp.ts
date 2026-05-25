import { type SharedObject, useReleasingSharedObject } from 'expo-modules-core'

import ExpoWavySliderModule from '../ExpoWavySliderModule'
import { worklets } from '../utils/ensureWorklets'

type InstancedSharedObject = InstanceType<typeof SharedObject>

export default function useWorkletProp(
	callback: ((value: number) => void) | ((value: boolean) => void) | undefined,
	propName: string,
): InstancedSharedObject | null {
	return useReleasingSharedObject(() => {
		if (!callback) {
			return null as unknown as InstancedSharedObject
		}
		try {
			return new ExpoWavySliderModule.WorkletCallback(
				worklets.createSerializable(callback),
			)
		} catch {
			throw new Error(
				`${propName} must be a worklet function. Add the 'worklet' directive as the first statement in your callback.`,
			)
		}
	}, [callback])
}
