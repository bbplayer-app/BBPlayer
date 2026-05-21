# expo-wavy-slider

Android Expo module that exposes [`ir.mahozad.multiplatform:wavy-slider`](https://github.com/mahozad/wavy-slider) as a React Native view.

The native view is implemented with Jetpack Compose. High-frequency values can be driven from Reanimated shared values or from this package's native `ObservableState`, so player progress and wave animations can update without React re-renders.

## Platform Support

| Platform | Status          |
| -------- | --------------- |
| Android  | Supported       |
| iOS      | Not implemented |
| Web      | Not implemented |

## Requirements

- Expo Modules
- React Native New Architecture
- `react-native-worklets`
- `react-native-reanimated`

This package requires a development build or a prebuilt native app. It does not run in Expo Go.

## Installation

```sh
pnpm add expo-wavy-slider react-native-worklets react-native-reanimated
```

`expo`, `react`, `react-native`, `react-native-worklets`, and `react-native-reanimated` are peer dependencies. They are resolved from your app so the native runtime stays aligned with the Expo SDK and React Native version you build with.

## Example App

This repository includes a standalone Expo example app:

```sh
cd packages/expo-wavy-slider/example
pnpm android
```

The example renders a React-state slider, a Reanimated-driven slider, and an explicit `useNativeState` slider.

## Basic Usage

```tsx
import { WavySlider } from 'expo-wavy-slider'
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

Callback props must be worklet functions. Use `scheduleOnRN` when a callback needs to update React state or run other JS-thread work.

## Reanimated Shared Values

`progress`, `bufferedProgress`, `waveLength`, `waveHeight`, `waveVelocity`, `waveThickness`, and `trackThickness` accept Reanimated shared values.

Internally the component creates an `ObservableState` and starts a Reanimated mapper with `startMapper()`. The mapper copies `sharedValue.value` into native state on the UI runtime, and `stopMapper()` is called when the component unmounts or the prop changes.

```tsx
import { WavySlider } from 'expo-wavy-slider'
import {
	Easing,
	useAnimatedReaction,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

export function AnimatedPlayerSlider({
	duration,
	position,
	isPlaying,
}: {
	duration: number
	position: number
	isPlaying: boolean
}) {
	const sharedPosition = useSharedValue(position)
	const playing = useSharedValue(isPlaying)
	const waveHeight = useSharedValue(isPlaying ? 8 : 0)
	const waveVelocity = useSharedValue(isPlaying ? 16 : 0)
	const trackThickness = useSharedValue(4)

	const progress = useDerivedValue(() => {
		const safeDuration = duration || 1
		return Math.min(Math.max(sharedPosition.value / safeDuration, 0), 1)
	})

	useAnimatedReaction(
		() => playing.value,
		(value) => {
			waveHeight.value = withTiming(value ? 8 : 0, {
				duration: 280,
				easing: Easing.out(Easing.cubic),
			})
			waveVelocity.value = withTiming(value ? 16 : 0, {
				duration: 120,
			})
		},
	)

	return (
		<WavySlider
			style={{ width: '100%', height: 32 }}
			progress={progress}
			waveHeight={waveHeight}
			waveVelocity={waveVelocity}
			trackThickness={trackThickness}
			onDragStateChange={(dragging) => {
				'worklet'
				trackThickness.value = withTiming(dragging ? 12 : 4, {
					duration: 180,
				})
			}}
		/>
	)
}
```

## Native State

`useNativeState(initialValue)` creates an Expo `SharedObject` backed by native state. On Android it is read by Compose as observable state, so assigning `state.value` from a worklet updates the native UI directly.

You usually do not need this hook when you already have a Reanimated shared value, because `WavySlider` bridges shared values internally. Use `useNativeState` when another native module, callback, or worklet needs to own a value explicitly.

```tsx
import { WavySlider, useNativeState } from 'expo-wavy-slider'
import { useEffect } from 'react'

export function NativeStateExample() {
	const progress = useNativeState(0)

	useEffect(() => {
		progress.onChange = (value) => {
			'worklet'
			// Runs on the native UI runtime whenever progress.value changes.
		}

		return () => {
			progress.onChange = null
		}
	}, [progress])

	return (
		<WavySlider
			style={{ width: '100%', height: 32 }}
			progress={progress}
			onValueChange={(value) => {
				'worklet'
				progress.value = value
			}}
		/>
	)
}
```

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

| Prop                    | Type                                                       | Default     | Description                                                               |
| ----------------------- | ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `value`                 | `number`                                                   | `0`         | Current slider value. Used as a fallback when `progress` is not provided. |
| `progress`              | `SharedValue<number> \| ObservableState<number>`           | `undefined` | Native-driven current progress. Takes precedence over `value`.            |
| `bufferedValue`         | `number`                                                   | `0`         | Buffered or loaded progress value.                                        |
| `bufferedProgress`      | `SharedValue<number> \| ObservableState<number>`           | `undefined` | Native-driven buffered progress. Takes precedence over `bufferedValue`.   |
| `min`                   | `number`                                                   | `0`         | Minimum selectable value.                                                 |
| `max`                   | `number`                                                   | `1`         | Maximum selectable value.                                                 |
| `lowerLimit`            | `number`                                                   | `undefined` | Lower bound for user interaction.                                         |
| `upperLimit`            | `number`                                                   | `undefined` | Upper bound for user interaction.                                         |
| `enabled`               | `boolean`                                                  | `true`      | Whether user interaction is enabled.                                      |
| `colors`                | `WavySliderColors`                                         | `undefined` | Slider color configuration.                                               |
| `waveLength`            | `number \| SharedValue<number> \| ObservableState<number>` | `16`        | Wave length in dp. Set to `0` for a straight slider.                      |
| `waveHeight`            | `number \| SharedValue<number> \| ObservableState<number>` | `16`        | Wave height in dp. Set to `0` for a straight slider.                      |
| `waveVelocity`          | `number \| SharedValue<number> \| ObservableState<number>` | `15`        | Wave velocity in dp per second. Set to `0` to stop movement.              |
| `waveDirection`         | `'left' \| 'right' \| 'tail' \| 'head'`                    | `'head'`    | Wave movement direction.                                                  |
| `waveThickness`         | `number \| SharedValue<number> \| ObservableState<number>` | `4`         | Active wave stroke thickness in dp.                                       |
| `trackThickness`        | `number \| SharedValue<number> \| ObservableState<number>` | `4`         | Inactive and buffered track stroke thickness in dp.                       |
| `incremental`           | `boolean`                                                  | `false`     | Whether wave height gradually increases toward the thumb.                 |
| `onValueChange`         | `(value: number) => void`                                  | `undefined` | Worklet callback fired while the value changes.                           |
| `onValueChangeFinished` | `(value: number) => void`                                  | `undefined` | Worklet callback fired when dragging or tap-seeking finishes.             |
| `onDragStateChange`     | `(isDragged: boolean) => void`                             | `undefined` | Worklet callback fired when the native drag state changes.                |

## Notes

- Native code only renders the Compose slider and observes native state. Playback-specific animation policy belongs in JavaScript.
- Shared value props are bridged inside `WavySlider`; consumers do not need to manually create `ObservableState` for common Reanimated animations.
- `react-native-reanimated` is required because `expo.installOnUIRuntime()` currently depends on the UI runtime pointer installed by Reanimated's runtime decorator.
