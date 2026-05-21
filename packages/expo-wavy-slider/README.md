# @bbplayer/wavy-slider

Android Expo module that exposes [`ir.mahozad.multiplatform:wavy-slider`](https://github.com/mahozad/wavy-slider) as a React Native view.

The native view is implemented with Jetpack Compose and supports worklet callbacks plus native observable state, so media progress and visual parameters can be updated from the UI runtime without forcing React re-renders.

## Platform Support

| Platform | Status          |
| -------- | --------------- |
| Android  | Supported       |
| iOS      | Not implemented |
| Web      | Not implemented |

## Requirements

- Expo Modules
- React Native with the New Architecture enabled
- `react-native-worklets`
- `react-native-reanimated`

`react-native-reanimated` is currently required because `expo.installOnUIRuntime()` depends on the UI runtime pointer installed by Reanimated's runtime decorator.

## Installation

```sh
pnpm add @bbplayer/wavy-slider react-native-worklets react-native-reanimated
```

This package contains native Android code, so it requires a development build or a prebuilt native app. It will not run inside Expo Go.

## Basic Usage

```tsx
import { WavySlider } from '@bbplayer/wavy-slider'
import { useState } from 'react'
import { scheduleOnRN } from 'react-native-worklets'

export function Example() {
	const [value, setValue] = useState(0.5)

	return (
		<WavySlider
			style={{ width: '100%', height: 32 }}
			value={value}
			onValueChange={(nextValue) => {
				'worklet'
				scheduleOnRN(setValue, nextValue)
			}}
			waveLength={16}
			waveHeight={16}
			waveVelocity={15}
			waveDirection='head'
			waveThickness={4}
			trackThickness={4}
		/>
	)
}
```

Callback props must be worklet functions. For React state updates or other JS-thread work, call back to JS with `scheduleOnRN` from `react-native-worklets`.

## Native State Usage

Use `useNativeState()` when a value changes frequently and should update the native Compose UI without going through React renders.

```tsx
import { WavySlider, useNativeState } from '@bbplayer/wavy-slider'
import {
	useAnimatedReaction,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

export function PlayerProgress({ isPlaying }: { isPlaying: boolean }) {
	const progress = useNativeState(0)
	const waveHeight = useNativeState(isPlaying ? 8 : 0)
	const waveVelocity = useNativeState(isPlaying ? 15 : 0)
	const sharedProgress = useSharedValue(0)
	const playing = useSharedValue(isPlaying)
	const animatedWaveHeight = useSharedValue(isPlaying ? 8 : 0)
	const animatedWaveVelocity = useSharedValue(isPlaying ? 15 : 0)

	useAnimatedReaction(
		() => sharedProgress.value,
		(value) => {
			progress.value = value
		},
		[progress],
	)

	useAnimatedReaction(
		() => playing.value,
		(value) => {
			animatedWaveHeight.value = withTiming(value ? 8 : 0, { duration: 250 })
			animatedWaveVelocity.value = withTiming(value ? 15 : 0, { duration: 120 })
		},
		[animatedWaveHeight, animatedWaveVelocity],
	)

	useAnimatedReaction(
		() => [animatedWaveHeight.value, animatedWaveVelocity.value] as const,
		([nextWaveHeight, nextWaveVelocity]) => {
			waveHeight.value = nextWaveHeight
			waveVelocity.value = nextWaveVelocity
		},
		[animatedWaveHeight, animatedWaveVelocity, waveHeight, waveVelocity],
	)

	return (
		<WavySlider
			style={{ width: '100%', height: 32 }}
			progress={progress}
			waveHeight={waveHeight}
			waveVelocity={waveVelocity}
		/>
	)
}
```

`ObservableState` is a native shared object. Its `.value` setter is available in worklets after this package registers its custom serializer.

## Buffered Progress

`bufferedValue` and `bufferedProgress` draw a buffered track between the current value and the buffered value.

```tsx
<WavySlider
	value={0.35}
	bufferedValue={0.72}
	colors={{
		activeTrackColor: '#ff4b7a',
		bufferedTrackColor: 'rgba(255, 75, 122, 0.28)',
		inactiveTrackColor: '#444',
		thumbColor: '#ff4b7a',
	}}
/>
```

## Props

| Prop                    | Type                                    | Default     | Description                                                                           |
| ----------------------- | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `value`                 | `number`                                | `0`         | Current slider value. Used as a fallback when `progress` is not provided.             |
| `progress`              | `ObservableState<number>`               | `undefined` | Native observable state for current progress. Takes precedence over `value`.          |
| `bufferedValue`         | `number`                                | `0`         | Buffered or loaded progress value.                                                    |
| `bufferedProgress`      | `ObservableState<number>`               | `undefined` | Native observable state for buffered progress. Takes precedence over `bufferedValue`. |
| `min`                   | `number`                                | `0`         | Minimum selectable value.                                                             |
| `max`                   | `number`                                | `1`         | Maximum selectable value.                                                             |
| `lowerLimit`            | `number`                                | `undefined` | Lower bound for user interaction.                                                     |
| `upperLimit`            | `number`                                | `undefined` | Upper bound for user interaction.                                                     |
| `enabled`               | `boolean`                               | `true`      | Whether user interaction is enabled.                                                  |
| `colors`                | `WavySliderColors`                      | `undefined` | Slider color configuration.                                                           |
| `waveLength`            | `number \| ObservableState<number>`     | `16`        | Wave length in dp. Set to `0` for a straight slider.                                  |
| `waveHeight`            | `number \| ObservableState<number>`     | `16`        | Wave height in dp. Set to `0` for a straight slider.                                  |
| `waveVelocity`          | `number \| ObservableState<number>`     | `15`        | Wave velocity in dp per second. Set to `0` to stop movement.                          |
| `waveDirection`         | `'left' \| 'right' \| 'tail' \| 'head'` | `'head'`    | Wave movement direction.                                                              |
| `waveThickness`         | `number \| ObservableState<number>`     | `4`         | Active wave stroke thickness in dp.                                                   |
| `trackThickness`        | `number \| ObservableState<number>`     | `4`         | Inactive and buffered track stroke thickness in dp.                                   |
| `incremental`           | `boolean`                               | `false`     | Whether wave height gradually increases toward the thumb.                             |
| `onValueChange`         | `(value: number) => void`               | `undefined` | Worklet callback fired while the value changes.                                       |
| `onValueChangeFinished` | `(value: number) => void`               | `undefined` | Worklet callback fired when dragging or tap-seeking finishes.                         |
| `onDragStateChange`     | `(isDragged: boolean) => void`          | `undefined` | Worklet callback fired when the native drag state changes.                            |

## Shared Values

Pass `ObservableState<number>` to this component for values that should be updated from worklets.

Directly passing a Reanimated `SharedValue` as a normal prop is not supported by this module. A `SharedValue` is a JavaScript object, while Expo Modules prop conversion expects values that can be converted by the native type converter. Use `useAnimatedReaction()` to bridge `SharedValue` changes into `ObservableState.value`.

## Notes

- This package intentionally keeps playback-specific animation policy in JavaScript. Native code only renders the Compose slider and observes native state.
- `waveLength`, `waveHeight`, `waveVelocity`, `waveThickness`, and `trackThickness` accept either plain numbers or `ObservableState<number>`.
- `progress` and `bufferedProgress` are always native states, because they are intended for high-frequency UI updates.
