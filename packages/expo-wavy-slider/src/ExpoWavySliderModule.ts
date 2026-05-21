import { requireNativeModule } from 'expo'
import { SharedObject } from 'expo-modules-core'
import { Platform } from 'react-native'

type NativeSharedObject = InstanceType<typeof SharedObject>

declare class ExpoWavySliderModule {
	ObservableState: new (initial: { value: unknown }) => NativeSharedObject & {
		getValue(): unknown
		setValue(value: { value: unknown }): void
		setOnChange(callback: object | null): void
	}
	WorkletCallback: new (worklet: object) => NativeSharedObject
}

const unsupportedPlatformModule = new Proxy(
	{},
	{
		get() {
			throw new Error(
				'[expo-wavy-slider] WavySlider is only implemented on Android.',
			)
		},
	},
) as ExpoWavySliderModule

export default Platform.OS === 'android'
	? requireNativeModule<ExpoWavySliderModule>('ExpoWavySlider')
	: unsupportedPlatformModule
