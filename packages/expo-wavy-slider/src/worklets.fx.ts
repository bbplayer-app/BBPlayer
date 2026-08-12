/*
  huge thx to expo-ui
  inspired by https://github.com/expo/expo/blob/main/packages/expo-ui/src/State/index.fx.ts
*/
import { installOnUIRuntime } from 'expo'

import { worklets } from './utils/ensureWorklets'
import {
	EXPO_SHARED_OBJECT_ID_KEY,
	isWavySliderSharedObject,
	type WavySliderSharedObject,
} from './utils/sharedObjectBrand'

type PackedSharedObject = { objectId: number }

let serializerRegistered = false

function registerSharedObjectSerializer(): void {
	if (serializerRegistered || !worklets) return

	serializerRegistered = true
	worklets.registerCustomSerializable<
		WavySliderSharedObject,
		PackedSharedObject
	>({
		name: 'ExpoWavySliderSharedObject',
		determine: (value): value is WavySliderSharedObject => {
			'worklet'
			return isWavySliderSharedObject(value)
		},
		pack: (value) => {
			'worklet'
			return { objectId: value[EXPO_SHARED_OBJECT_ID_KEY] }
		},
		unpack: (packed) => {
			'worklet'
			const sharedObject = (
				globalThis as typeof globalThis & {
					expo: {
						SharedObject: {
							__resolveInWorklet(id: number): {
								getValue?: () => unknown
								setValue?: (value: { value: unknown }) => void
							}
						}
					}
				}
			).expo.SharedObject
			// oxlint-disable-next-line no-underscore-dangle
			const obj = sharedObject.__resolveInWorklet(packed.objectId)

			if (
				typeof obj.getValue === 'function' &&
				typeof obj.setValue === 'function'
			) {
				Object.defineProperty(obj, 'value', {
					get() {
						return obj.getValue?.()
					},
					set(value: unknown) {
						if (value === undefined) return

						obj.setValue?.({ value })
					},
				})
			}

			return obj as unknown as WavySliderSharedObject
		},
	})
}

installOnUIRuntime(worklets.getUIRuntimeHolder())
registerSharedObjectSerializer()
