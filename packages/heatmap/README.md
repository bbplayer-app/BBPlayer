# @bbplayer/heatmap

A customizable heatmap component for React Native. WeeklyHeatMap uses Skia for the cells and SVG for labels; MonthlyHeatMap uses SVG.

## Features

- **MonthlyHeatMap**: Grid of months.
- **WeeklyHeatMap**: Continuous activity graph (GitHub style).
- Customizable colors, sizes, and themes.
- Support for `light` and `dark` modes.
- Support for RTL layouts.
- Pressable cells with callbacks.

## Installation

```bash
pnpm add @bbplayer/heatmap
```

Note: You must also have `@shopify/react-native-skia`, `react-native-svg` and `dayjs` installed in your project.

## Usage

```tsx
import { WeeklyHeatMap } from '@bbplayer/heatmap'

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
