import { Orpheus } from '@bbplayer/orpheus'
import { useEffect, useRef } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'

const BAR_COUNT = 32
const FFT_SIZE = 1024 // Buffer size we might pull, but we only show 32 bars
// Since FFT is 512 bins (Nyquist), we can bin them.

export const SpectrumVisualizer = ({ isPlaying }: { isPlaying: boolean }) => {
	const barsRef = useRef<(View | null)[]>([])
	const rafRef = useRef<number | null>(null)
	const bufferRef = useRef(new Float32Array(FFT_SIZE / 2))
	const dimensions = useWindowDimensions()

	useEffect(() => {
		const animate = () => {
			if (!isPlaying) return

			// Pull data
			Orpheus.updateSpectrumData(bufferRef.current)
			const data = bufferRef.current

			// Update bars
			// Simple linear sampling for demo
			const step = Math.floor(data.length / BAR_COUNT)

			for (let i = 0; i < BAR_COUNT; i++) {
				const view = barsRef.current[i]
				if (view) {
					// Average or Max in the bin
					let sum = 0
					const start = i * step
					const end = start + step
					for (let j = start; j < end; j++) {
						sum += data[j]
					}
					const avg = sum / step

					// Draw
					// Height 0-100
					// Magnitudes are 0-1 usually.
					const height = Math.min(Math.max(avg * 200, 2), 150)

					view.setNativeProps({
						style: {
							height: height,
							backgroundColor: `hsl(${i * 10}, 80%, 60%)`,
						},
					})
				}
			}

			rafRef.current = requestAnimationFrame(animate)
		}

		if (isPlaying) {
			animate()
		} else {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current)
				rafRef.current = null
			}
			// Reset bars
			for (let i = 0; i < BAR_COUNT; i++) {
				barsRef.current[i]?.setNativeProps({ style: { height: 2 } })
			}
		}

		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current)
			}
		}
	}, [isPlaying])

	return (
		<View style={styles.container}>
			{Array.from({ length: BAR_COUNT }).map((_, i) => (
				<View
					key={i}
					ref={(ref) => {
						barsRef.current[i] = ref
					}}
					style={[
						styles.bar,
						{
							backgroundColor: `hsl(${i * 10}, 80%, 50%)`,
							width: (dimensions.width - 80) / BAR_COUNT,
						},
					]}
				/>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'space-between',
		height: 160,
		backgroundColor: '#222',
		padding: 10,
		borderRadius: 10,
		marginVertical: 10,
	},
	bar: {
		height: 2,
		borderRadius: 2,
	},
})
