---
description: Best practice for measuring component layout in React Native
---

# Measuring Component Layout

When you need to measure the current layout to apply changes to the overall layout or to make decisions based on precise coordinates (especially relative to the screen/page), use `measure` within `useLayoutEffect`.

This approach ensures you get the most recent values and can apply changes in the same frame, preventing UI flickering.

## Recommended Pattern

```tsx
function AComponent({ children }) {
	const targetRef = React.useRef(null)

	useLayoutEffect(
		() => {
			targetRef.current?.measure((x, y, width, height, pageX, pageY) => {
				// x, y: position relative to parent
				// width, height: dimensions
				// pageX, pageY: absolute position on screen
				// Do something with the measurements
			})
		},
		[
			/* dependencies */
		],
	)

	return <View ref={targetRef}>{children}</View>
}
```

## When to use `onLayout` vs `measure`

- **Use `onLayout`**: When you only need the size (`width`, `height`) or position relative to the parent (`x`, `y`). It is simpler but passive.
- **Use `measure`**: When you need absolute coordinates (`pageX`, `pageY`) or need to trigger logic synchronously after the view is ready to avoid visual jumps.
