import { Orpheus, SPECTRUM_SIZE } from '@roitium/expo-orpheus'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { useEffect, useRef, useState } from 'react'
import { AppState, PermissionsAndroid, Platform, View } from 'react-native'
import { useDerivedValue, useSharedValue } from 'react-native-reanimated'

import { alert } from '@/components/modals/AlertModal'
import useAppStore from '@/hooks/stores/useAppStore'

interface SpectrumVisualizerProps {
	isPlaying: boolean
	color?: string
	size: number
}

const BAR_COUNT = 60
const MAX_BAR_HEIGHT = 36
const SMOOTHING_FACTOR = 0.3
const GAP = 4

export const SpectrumVisualizer = ({
	isPlaying,
	color = 'white',
	size,
}: SpectrumVisualizerProps) => {
	const frequencyData = useSharedValue<Float32Array>(
		new Float32Array(BAR_COUNT).fill(0),
	)
	const bufferRef = useRef(new Float32Array(SPECTRUM_SIZE))
	const prevDataRef = useRef(new Float32Array(BAR_COUNT))

	const [isAppActive, setIsAppActive] = useState(
		AppState.currentState === 'active',
	)
	const [hasPermission, setHasPermission] = useState<boolean | null>(null)

	const setSettings = useAppStore((state) => state.setSettings)

	useEffect(() => {
		const checkPermission = async () => {
			if (Platform.OS === 'android') {
				const granted = await PermissionsAndroid.check(
					PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
				)
				setHasPermission(granted)

				if (!granted) {
					alert(
						'需要麦克风权限',
						'音频频谱功能需要访问麦克风以分析音频数据。请授予权限以继续使用此功能。',
						[
							{
								text: '取消',
								onPress: () => {
									setSettings({ enableSpectrumVisualizer: false })
								},
							},
							{
								text: '授权',
								onPress: () => {
									void PermissionsAndroid.request(
										PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
									).then((result) => {
										const isGranted =
											result === PermissionsAndroid.RESULTS.GRANTED
										setHasPermission(isGranted)
										if (!isGranted) {
											setSettings({ enableSpectrumVisualizer: false })
										}
									})
								},
							},
						],
						{ cancelable: false },
					)
				}
			} else {
				setHasPermission(true)
			}
		}

		void checkPermission()
	}, [setSettings])

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (nextAppState) => {
			setIsAppActive(nextAppState === 'active')
		})

		return () => {
			subscription.remove()
		}
	}, [])

	const geometry = useDerivedValue(() => {
		const center = size / 2 + MAX_BAR_HEIGHT
		const radius = size / 2 + GAP
		const result = new Float32Array(BAR_COUNT * 4)

		for (let i = 0; i < BAR_COUNT; i++) {
			const angle = (i / BAR_COUNT) * 2 * Math.PI - Math.PI / 2
			result[i * 4] = center + radius * Math.cos(angle)
			result[i * 4 + 1] = center + radius * Math.sin(angle)
			result[i * 4 + 2] = Math.cos(angle)
			result[i * 4 + 3] = Math.sin(angle)
		}
		return result
	}, [size])

	const path = useDerivedValue(() => {
		const skPath = Skia.Path.Make()
		const geo = geometry.value
		const freq = frequencyData.value

		for (let i = 0; i < BAR_COUNT; i++) {
			const val = freq[i] || 0
			const barHeight = Math.min(
				Math.max(val * MAX_BAR_HEIGHT, 4),
				MAX_BAR_HEIGHT,
			)

			const px = geo[i * 4]
			const py = geo[i * 4 + 1]
			const nx = geo[i * 4 + 2]
			const ny = geo[i * 4 + 3]

			skPath.moveTo(px, py)
			skPath.lineTo(px + nx * barHeight, py + ny * barHeight)
		}

		return skPath
	}, [geometry])

	useEffect(() => {
		if (!hasPermission) return

		let animationFrameId: number
		let lastFrameTime = 0
		const TARGET_FPS = 30
		const FRAME_INTERVAL = 1000 / TARGET_FPS
		const DECAY_FACTOR = 0.9

		const animate = (timestamp: number) => {
			if (!isAppActive) return

			const elapsed = timestamp - lastFrameTime

			if (elapsed >= FRAME_INTERVAL) {
				lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL)

				const newData = new Float32Array(BAR_COUNT)
				const rawData = bufferRef.current
				let hasSignal = false

				if (isPlaying) {
					Orpheus.updateSpectrumData(rawData)
					const halfCount = BAR_COUNT / 2

					for (let i = 0; i < halfCount; i++) {
						const t = i / (halfCount - 1)
						const startBin = Math.floor(t * t * (SPECTRUM_SIZE - 1))
						const tNext = (i + 1) / (halfCount - 1)
						const endBin = Math.floor(tNext * tNext * (SPECTRUM_SIZE - 1))
						const actualEndBin = Math.max(endBin, startBin + 1)

						let sum = 0
						let count = 0
						for (let j = startBin; j < actualEndBin && j < SPECTRUM_SIZE; j++) {
							sum += rawData[j]
							count++
						}

						let val = 0
						if (count > 0) {
							const magnitude = sum / count
							const db = 20 * Math.log10(magnitude + 0.0001)
							const minDb = -60
							const maxDb = 0
							val = (db - minDb) / (maxDb - minDb)
						}

						if (val < 0) val = 0
						if (val > 1.0) val = 1.0

						const mirrorIdx = BAR_COUNT - 1 - i

						const smoothL =
							prevDataRef.current[i] * SMOOTHING_FACTOR +
							val * (1 - SMOOTHING_FACTOR)
						prevDataRef.current[i] = smoothL
						newData[i] = smoothL

						const smoothR =
							prevDataRef.current[mirrorIdx] * SMOOTHING_FACTOR +
							val * (1 - SMOOTHING_FACTOR)
						prevDataRef.current[mirrorIdx] = smoothR
						newData[mirrorIdx] = smoothR

						if (smoothL > 0.001 || smoothR > 0.001) {
							hasSignal = true
						}
					}
				} else {
					// Decay logic when paused
					for (let i = 0; i < BAR_COUNT; i++) {
						const decayed = prevDataRef.current[i] * DECAY_FACTOR
						if (decayed > 0.001) {
							prevDataRef.current[i] = decayed
							newData[i] = decayed
							hasSignal = true
						} else {
							prevDataRef.current[i] = 0
							newData[i] = 0
						}
					}
				}

				frequencyData.set(newData)

				// If no signal and not playing, stop the loop to save resources
				if (!isPlaying && !hasSignal) {
					return
				}
			}

			animationFrameId = requestAnimationFrame(animate)
		}

		if (isAppActive) {
			animationFrameId = requestAnimationFrame(animate)
		}

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId)
			}
		}
	}, [frequencyData, isPlaying, isAppActive, hasPermission])

	if (hasPermission !== true) {
		return null
	}

	const containerSize = size + MAX_BAR_HEIGHT * 2

	return (
		<View
			style={{
				width: containerSize,
				height: containerSize,
				pointerEvents: 'none',
			}}
		>
			<Canvas style={{ flex: 1 }}>
				<Path
					path={path}
					color={color}
					style='stroke'
					strokeWidth={4}
					strokeCap='round'
					opacity={0.6}
				/>
			</Canvas>
		</View>
	)
}
