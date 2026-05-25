export const WAVY_SLIDER_SHARED_OBJECT_BRAND =
	'__expo_wavy_slider_shared_object__'
export const EXPO_SHARED_OBJECT_ID_KEY = '__expo_shared_object_id__'

export type WavySliderSharedObject = {
	[EXPO_SHARED_OBJECT_ID_KEY]: number
	[WAVY_SLIDER_SHARED_OBJECT_BRAND]: true
}

export function isWavySliderSharedObject(
	value: unknown,
): value is WavySliderSharedObject {
	'worklet'
	const objectId = (value as { [EXPO_SHARED_OBJECT_ID_KEY]?: number })[
		EXPO_SHARED_OBJECT_ID_KEY
	]

	return (
		value != null &&
		typeof value === 'object' &&
		EXPO_SHARED_OBJECT_ID_KEY in value &&
		objectId !== 0 &&
		(value as Partial<WavySliderSharedObject>)[
			WAVY_SLIDER_SHARED_OBJECT_BRAND
		] === true
	)
}
