import { requireNativeModule } from 'expo'
import { SharedObject } from 'expo-modules-core'

type NativeSharedObject = InstanceType<typeof SharedObject>

declare class ExpoWavySliderModule {
	ObservableState: new (initial: { value: unknown }) => NativeSharedObject & {
		getValue(): unknown
		setValue(value: { value: unknown }): void
		setOnChange(callback: object | null): void
	}
	WorkletCallback: new (worklet: object) => NativeSharedObject
}

export default requireNativeModule<ExpoWavySliderModule>('ExpoWavySlider')
