# @bbplayer/react-native-heatmap

A customizable heatmap component for React Native, built with `react-native-svg` and `dayjs`. Reimplemented from `react-native-heatmap`.

## Features

- **MonthlyHeatMap**: Grid of months.
- **WeeklyHeatMap**: Continuous activity graph (GitHub style).
- Customizable colors, sizes, and themes.
- Support for `light` and `dark` modes.
- Support for RTL layouts.
- Pressable cells with callbacks.

## Installation

```bash
pnpm add @bbplayer/react-native-heatmap
```

Note: You must also have `react-native-svg` and `dayjs` installed in your project.

## Usage

```tsx
import { WeeklyHeatMap } from '@bbplayer/react-native-heatmap'

const data = {
	'2024-01-01': 5,
	'2024-01-02': 10,
}

;<WeeklyHeatMap
	data={data}
	scheme='dark'
	onCellPress={({ date, count }) => console.log(date, count)}
/>
```
