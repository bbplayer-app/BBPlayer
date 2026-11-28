import { Orpheus, SPECTRUM_SIZE } from '@bbplayer/orpheus'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { useIsFocused } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import { useDerivedValue, useSharedValue } from 'react-native-reanimated'

interface SpectrumVisualizerProps {
	isPlaying: boolean
	color?: string
	size: number
}

const BAR_COUNT = 60
const MAX_BAR_HEIGHT = 36
const GAP = 4

// 圆环左右对称：从正上方往下，频率从低到高
const HALF_COUNT = BAR_COUNT / 2

// 原生端是 1024 点 FFT，按 48kHz 估算每个 bin 的频率（44.1kHz 时略有偏差，不影响观感）
const BIN_HZ = 48000 / (SPECTRUM_SIZE * 2)
const MIN_FREQ = 50

// B 站的 AAC 一般在 16kHz 左右截止，再往上几乎没有能量，分给它的条会一直不动
const MAX_FREQ = 16000

// 音乐的能量大致按每倍频程 3~6dB 随频率下降，按 1kHz 为基准补偿回来，高频的条才动得起来
const TILT_DB_PER_OCTAVE = 4.5
const MIN_DB = -50

// 上升快、回落慢，跟着鼓点跳但不闪
const ATTACK = 0.6
const RELEASE = 0.15

// 自动增益：按最近的峰值归一化，安静的歌也能撑满。峰值每帧衰减一点，换歌后几秒内适应
const AGC_DECAY = 0.99
const AGC_MIN_PEAK = 0.3

// 直通状态只在换歌、换输出设备时变化，每秒查一次就够
const PASSTHROUGH_CHECK_INTERVAL = 1000

// 每根条对应的 bin 范围：按对数频率均分，低频不足一个 bin 时顺延，保证每根条至少有一个 bin
const BAND_EDGES = (() => {
	const edges = new Int32Array(HALF_COUNT + 1)

	for (let i = 0; i <= HALF_COUNT; i++) {
		const freq = MIN_FREQ * (MAX_FREQ / MIN_FREQ) ** (i / HALF_COUNT)
		const bin = Math.round(freq / BIN_HZ)
		edges[i] = Math.min(
			Math.max(bin, i > 0 ? edges[i - 1] + 1 : 1),
			SPECTRUM_SIZE,
		)
	}

	return edges
})()

const BAND_TILT_DB = (() => {
	const tilt = new Float32Array(HALF_COUNT)

	for (let i = 0; i < HALF_COUNT; i++) {
		const centerHz = ((BAND_EDGES[i] + BAND_EDGES[i + 1]) / 2) * BIN_HZ
		tilt[i] = TILT_DB_PER_OCTAVE * Math.log2(centerHz / 1000)
	}

	return tilt
})()

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
	const bandLevelsRef = useRef(new Float32Array(HALF_COUNT))
	const agcPeakRef = useRef(AGC_MIN_PEAK)
	const lastPassthroughCheckRef = useRef(0)

	// 直通时压缩音频原样交给系统或外接设备解码，App 拿不到 PCM，频谱没有数据，干脆不画（说明写在频谱开关那里）
	const [isPassthrough, setIsPassthrough] = useState(() =>
		Orpheus.isSpectrumPassthrough(),
	)

	const [isAppActive, setIsAppActive] = useState(
		AppState.currentState === 'active',
	)

	// 播放页被其他页面盖住时也要停下采集和动画
	const isFocused = useIsFocused()
	const isVisible = isAppActive && isFocused

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
		const skPath = Skia.PathBuilder.Make()
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

		return skPath.build()
	}, [geometry])

	useEffect(() => {
		let animationFrameId: number
		let lastFrameTime = 0
		const TARGET_FPS = 30
		const FRAME_INTERVAL = 1000 / TARGET_FPS
		const DECAY_FACTOR = 0.9

		const animate = (timestamp: number) => {
			if (!isVisible) return

			const elapsed = timestamp - lastFrameTime

			if (elapsed >= FRAME_INTERVAL) {
				lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL)

				const newData = new Float32Array(BAR_COUNT)
				const rawData = bufferRef.current
				let hasSignal = false

				if (
					timestamp - lastPassthroughCheckRef.current >=
					PASSTHROUGH_CHECK_INTERVAL
				) {
					lastPassthroughCheckRef.current = timestamp
					setIsPassthrough(Orpheus.isSpectrumPassthrough())
				}

				if (isPlaying) {
					Orpheus.updateSpectrumData(rawData)
					const levels = bandLevelsRef.current
					let framePeak = 0

					for (let i = 0; i < HALF_COUNT; i++) {
						// 取频带内的最大值而不是平均值，宽的高频带不会被平均得一片平
						let magnitude = 0

						for (let j = BAND_EDGES[i]; j < BAND_EDGES[i + 1]; j++) {
							if (rawData[j] > magnitude) magnitude = rawData[j]
						}

						const db = 20 * Math.log10(magnitude + 1e-6) + BAND_TILT_DB[i]
						const level = Math.min(Math.max((db - MIN_DB) / -MIN_DB, 0), 1)
						levels[i] = level

						if (level > framePeak) framePeak = level
					}

					const agcPeak = Math.max(
						framePeak,
						agcPeakRef.current * AGC_DECAY,
						AGC_MIN_PEAK,
					)

					agcPeakRef.current = agcPeak

					for (let i = 0; i < HALF_COUNT; i++) {
						const target = Math.min(levels[i] / agcPeak, 1)
						const prev = prevDataRef.current[i]

						const smooth =
							prev + (target - prev) * (target > prev ? ATTACK : RELEASE)

						const mirrorIdx = BAR_COUNT - 1 - i

						prevDataRef.current[i] = smooth
						prevDataRef.current[mirrorIdx] = smooth
						newData[i] = smooth
						newData[mirrorIdx] = smooth

						if (smooth > 0.001) {
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

		if (isVisible) {
			animationFrameId = requestAnimationFrame(animate)
		}

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId)
			}
		}
	}, [frequencyData, isPlaying, isVisible])

	const containerSize = size + MAX_BAR_HEIGHT * 2

	return (
		<View
			style={{
				width: containerSize,
				height: containerSize,
				pointerEvents: 'none',
			}}
		>
			{!isPassthrough && (
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
			)}
		</View>
	)
}
