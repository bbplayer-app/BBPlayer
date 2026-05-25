# expo-wavy-slider

An Android Expo module that exposes [`ir.mahozad.multiplatform:wavy-slider`](https://github.com/mahozad/wavy-slider) as a React Native view.

https://github.com/user-attachments/assets/66a530fc-7e13-4dad-b1a1-f744862fe055

> Animated wavy [Material Slider](https://m3.material.io/components/sliders/overview) and progress/seek bar similar to the one used in [**Android 13** media controls](https://www.xda-developers.com/android-13-beta-1-media-controls-animation/).  
> It has curly, wobbly, squiggly, wiggly, jiggly, wriggly, dancing movements.
> Some users call it the **sperm**.

### Key Features

- **High Performance**: Using SharedValue and SharedObject smoothly driven on the UI thread, bypassing React re-renders.
- **Highly Customizable**: Easily customize wave length, height, velocity, direction, thickness, and colors. (And you can animated most of them all in 60fps by using Reanimated!)
- **Custom Thumb Shapes**: Support for `circle`, `square`, `diamond`, and standard Material 3 thumbs.
- **Media-Ready**: Built-in buffered progress support, ideal for audio/video players.

## Platform Support

> [!WARNING]
> This package is only supported on Android.

## Requirements

- Expo
- React Native New Architecture
- `react-native-worklets`
- `react-native-reanimated`

This package requires a development build. It does not run in Expo Go.

## Installation

```sh
pnpm add expo-wavy-slider react-native-worklets react-native-reanimated
```

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

_BTW, Callback props **must** be worklet functions._

## Reanimated Shared Values

`progress`, `bufferedProgress`, `waveLength`, `waveHeight`, `waveVelocity`, `waveThickness`, and `trackThickness` accept Reanimated shared values.

So you can add cool animations to your slider.

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

> This concept is inspired by [ExpoUI's `useNativeState` hook](https://docs.expo.dev/versions/v56.0.0/sdk/ui/jetpack-compose/usenativestate/).
>
> And basically, all these codes were copied from ExpoUI repo : )

`useNativeState(initialValue)` creates an Expo `SharedObject`. On Android it is read by Compose as `MutableState`, so assigning `state.value` from a worklet updates the native UI directly.

You usually do not need this hook when you already have a Reanimated shared value, because `WavySlider` bridges shared values internally.

```tsx
import { WavySlider, useNativeState } from 'expo-wavy-slider'
import { useEffect } from 'react'

export function NativeStateExample() {
	const progress = useNativeState(0)

	useEffect(() => {
		progress.onChange = (value) => {
			'worklet'
			console.log(value)
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
| `thumbShape`            | `'default' \| 'circle' \| 'square' \| 'diamond'`           | `'default'` | Shape used for the slider thumb.                                          |
| `waveThickness`         | `number \| SharedValue<number> \| ObservableState<number>` | `4`         | Active wave stroke thickness in dp.                                       |
| `trackThickness`        | `number \| SharedValue<number> \| ObservableState<number>` | `4`         | Inactive and buffered track stroke thickness in dp.                       |
| `incremental`           | `boolean`                                                  | `false`     | Whether wave height gradually increases toward the thumb.                 |
| `onValueChange`         | `(value: number) => void`                                  | `undefined` | Worklet callback fired while the value changes.                           |
| `onValueChangeFinished` | `(value: number) => void`                                  | `undefined` | Worklet callback fired when dragging or tap-seeking finishes.             |
| `onDragStateChange`     | `(isDragged: boolean) => void`                             | `undefined` | Worklet callback fired when the native drag state changes.                |

### Callback Rules

> [!IMPORTANT]
> All callback props (`onValueChange`, `onValueChangeFinished`, and `onDragStateChange`) **must be worklet functions** because they are invoked directly from the UI thread runtime.
