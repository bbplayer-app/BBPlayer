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

/*
  `installOnUIRuntime()` currently depends on the runtime pointer exposed via
  `_WORKLET_RUNTIME`. In practice that value is installed by Reanimated's
  runtime decorator, so this package requires Reanimated even though the direct
  worklet APIs come from `react-native-worklets`.
  https://github.com/software-mansion/react-native-reanimated/blob/cfb12d0f747ad189d2ff7717b0774de8ec6f9897/packages/react-native-reanimated/Common/cpp/reanimated/RuntimeDecorators/RNRuntimeDecorator.cpp#L20
*/
try {
	// oxlint-disable-next-line
	require('react-native-reanimated')
} catch {
	throw new Error(
		'[expo-wavy-slider] react-native-reanimated is required. Please install it first.',
	)
}
installOnUIRuntime()
registerSharedObjectSerializer()
