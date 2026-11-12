import type { ColorInfo, ExtractedPalette } from '@bbplayer/image-theme-colors'
import {
	Canvas,
	Fill,
	LinearGradient,
	Shader,
	Skia,
} from '@shopify/react-native-skia'
import Color from 'color'
import { useEffect, useState } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import {
	AccessibilityInfo,
	AppState,
	PixelRatio,
	StyleSheet,
	useColorScheme,
	View,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import {
	cancelAnimation,
	Easing,
	useDerivedValue,
	useFrameCallback,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// 在同一次着色中混合，避免 Mask 的离屏颜色/alpha 图层提前量化。
const FLUID_SHADER = Skia.RuntimeEffect.Make(`
  uniform shader gradientA;
  uniform shader gradientB;
  uniform shader maskGradient;
  uniform float pixelRatio;

  half4 main(float2 position) {
    float4 a = gradientA.eval(position);
    float4 b = gradientB.eval(position);
    float mask = maskGradient.eval(position).a;
    float4 color = mix(a, b, mask);

    // 固定在物理像素上的零均值噪声；不随时间变化，避免闪烁。
    float2 pixel = floor(position * pixelRatio);
    float3 hash = fract(float3(pixel.x, pixel.y, pixel.x) * 0.1031);
    hash += dot(hash, hash.yzx + 33.33);
    float noise = fract((hash.x + hash.y) * hash.z) - 0.5;
    color.rgb = clamp(color.rgb + (noise / 255.0) * color.a, 0.0, color.a);
    return half4(color);
  }
`)

/** 两组不透明渐变的起止颜色：[A 起点, A 终点, B 起点, B 终点]。 */
export type FluidBackgroundColors = readonly [string, string, string, string]

/** 三层旋转周期（毫秒），负值表示逆时针。 */
const FLOW_PERIOD_A_MS = 60_000
const FLOW_PERIOD_B_MS = -36_000
const FLOW_PERIOD_MASK_MS = 45_000

/** 回绕周期：三层周期的最小公倍数，回绕时无视觉跳变。 */
const FLOW_WRAP_MS = 180_000

/**
 * 用系统时钟取相位，而不是每个实例从 0 开始。
 * 这样多个背景实例（播放页、歌词页、迷你条）的流动方向始终一致。
 */
const globalFlowElapsed = () => Date.now() % FLOW_WRAP_MS

export type FluidBackgroundColorScheme = 'light' | 'dark'

export interface FluidBackgroundColorOptions {
	/** 提色尚未完成或没有可用色块时的背景颜色。 */
	fallbackColor?: string
	/** 明暗模式，决定配色的明度与饱和度区间；默认按深色处理。 */
	colorScheme?: FluidBackgroundColorScheme
}

export interface FluidBackgroundProps {
	/** 图片主题色提取结果；图片加载和提色由调用方负责。 */
	palette?: ExtractedPalette | null
	/** 手动配色，优先于 palette。使用不透明颜色以保持原版合成效果。 */
	colors?: FluidBackgroundColors
	/** 提色尚未完成或没有可用色块时的背景颜色。 */
	fallbackColor?: string
	/** 配色依据的明暗模式；默认跟随系统。 */
	colorScheme?: FluidBackgroundColorScheme
	/** 播放暂停或页面隐藏时传 true；流动会缓动减速停止并保留当前画面。 */
	paused?: boolean
	/** 配色变化时的过渡时长，单位毫秒。 */
	transitionDuration?: number
	/** 暂停/恢复时流动加减速的缓动时长，单位毫秒。 */
	flowTransitionDuration?: number
	/** 默认绝对定位填满父容器；可覆盖为固定尺寸。 */
	style?: StyleProp<ViewStyle>
}

/** 深色主题压暗、浅色主题提亮，保证背景上的文字始终有足够对比度。 */
const LIGHTNESS_BANDS: Record<
	FluidBackgroundColorScheme,
	readonly [number, number]
> = {
	dark: [10, 44],
	light: [70, 96],
}

/** 饱和度下限避免灰脏，上限避免过艳。 */
const SATURATION_BANDS: Record<
	FluidBackgroundColorScheme,
	readonly [number, number]
> = {
	dark: [26, 62],
	light: [18, 46],
}

/**
 * 单层渐变两端点的明度差占明度区间的比例。
 * 太小时四色会挤在一起，流光看起来像静止的纯色块。
 */
const LIGHTNESS_SPREAD: Record<FluidBackgroundColorScheme, number> = {
	dark: 0.55,
	light: 0.5,
}

/** 派生色的最大色相偏移；保持邻近色，避免互补色混合发灰。 */
const HUE_OFFSET = 28

/** 种子色饱和度过低时色相不可靠，直接走中性灰阶。 */
const MIN_SEED_SATURATION = 15

/** 画面里真正的彩色像素占比低于该值时按无彩色处理。 */
const ACHROMATIC_RATIO = 0.08

/** 肤色色相区间；命中后压低饱和度，避免整片背景发红。 */
const SKIN_HUE_MIN = 8
const SKIN_HUE_MAX = 55
const SKIN_SATURATION_CAP = 46
const SKIN_MIN_VALUE = 45

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max)

interface FluidSeed {
	hue: number
	saturation: number
	value: number
}

/** 把色块转成 HSV，并用 s×v 近似感知色度（HSL 饱和度会把深色像素误判成高饱和）。 */
function toSample(swatch: ColorInfo) {
	const color = Color(swatch.hex)
	const hue = color.hue()
	const saturation = color.saturationv()
	const value = color.value()

	return {
		population: Math.max(swatch.population, 1),
		hue: Number.isFinite(hue) ? hue : 0,
		saturation,
		value,
		chroma: (saturation / 100) * (value / 100),
	}
}

/**
 * 按"占比 × 色度"求主色相：记住画面里面积最大的那种颜色，
 * 而不是被角落的小面积高饱和色块带跑。
 */
function pickFluidSeed(swatches: ColorInfo[]): FluidSeed | null {
	const samples = swatches.map(toSample)

	const totalPopulation = samples.reduce(
		(sum, sample) => sum + sample.population,
		0,
	)

	if (totalPopulation <= 0) return null

	let weightSum = 0
	let cosSum = 0
	let sinSum = 0
	let saturationSum = 0
	let valueSum = 0
	let coloredPopulation = 0

	for (const sample of samples) {
		if (sample.chroma < 0.02) continue

		const weight = sample.population * sample.chroma
		const radians = (sample.hue * Math.PI) / 180

		weightSum += weight
		cosSum += Math.cos(radians) * weight
		sinSum += Math.sin(radians) * weight
		saturationSum += sample.saturation * weight
		valueSum += sample.value * weight
		coloredPopulation += sample.population
	}

	if (weightSum <= 0) return null

	if (coloredPopulation / totalPopulation < ACHROMATIC_RATIO) return null

	const hue = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360
	const saturation = saturationSum / weightSum

	if (saturation < MIN_SEED_SATURATION) return null

	return {
		hue,
		saturation,
		value: valueSum / weightSum,
	}
}

/**
 * 从封面调色板统计主色相，在邻近色域内派生出两组渐变端点，
 * 并把明度约束到主题对应的区间：色相和谐，且背景永远落在可控明暗范围内。
 */
export function getFluidBackgroundColors(
	palette: ExtractedPalette | null | undefined,
	{
		fallbackColor = '#202124',
		colorScheme = 'dark',
	}: FluidBackgroundColorOptions = {},
): FluidBackgroundColors {
	const swatches =
		palette?.swatches && palette.swatches.length > 0
			? palette.swatches
			: [
					palette?.vibrant,
					palette?.lightVibrant,
					palette?.darkVibrant,
					palette?.dominant,
					palette?.muted,
					palette?.lightMuted,
					palette?.darkMuted,
				].filter(
					(swatch): swatch is ColorInfo =>
						swatch !== null && swatch !== undefined,
				)

	// 提色尚未完成：沿用外部背景色，避免先闪一帧灰阶。
	if (swatches.length === 0) {
		return [fallbackColor, fallbackColor, fallbackColor, fallbackColor]
	}

	const [minLightness, maxLightness] = LIGHTNESS_BANDS[colorScheme]
	const midLightness = (minLightness + maxLightness) / 2

	const lightnessSpread =
		(maxLightness - minLightness) * LIGHTNESS_SPREAD[colorScheme]

	const seed = pickFluidSeed(swatches)

	// 无彩色（灰 / 黑 / 白 / 饱和度太低）：只做明度层次，不凭空造色相。
	if (!seed) {
		const neutral = (lightness: number) =>
			Color.hsl(0, 0, clamp(lightness, minLightness, maxLightness)).hex()

		return [
			neutral(midLightness - lightnessSpread),
			neutral(midLightness + lightnessSpread),
			neutral(midLightness + lightnessSpread * 1.1),
			neutral(midLightness - lightnessSpread * 1.1),
		]
	}

	const isSkinTone =
		seed.hue >= SKIN_HUE_MIN &&
		seed.hue <= SKIN_HUE_MAX &&
		seed.value >= SKIN_MIN_VALUE &&
		seed.saturation <= 70

	const saturation = clamp(
		isSkinTone
			? Math.min(seed.saturation, SKIN_SATURATION_CAP)
			: seed.saturation,
		...SATURATION_BANDS[colorScheme],
	)

	const colorAt = (hueOffset: number, lightness: number, sat = saturation) =>
		Color.hsl(
			(seed.hue + hueOffset + 360) % 360,
			sat,
			clamp(lightness, minLightness, maxLightness),
		).hex()

	// A: [H, H+Δ]，B: [H-Δ, H]，共用同一邻近色簇。
	return [
		colorAt(0, midLightness - lightnessSpread),
		colorAt(HUE_OFFSET, midLightness + lightnessSpread, saturation * 1.04),
		colorAt(-HUE_OFFSET, midLightness + lightnessSpread * 1.1),
		colorAt(0, midLightness - lightnessSpread * 1.1, saturation * 0.98),
	]
}

interface RotatingGradientProps {
	colors: string[] | SharedValue<string[]>
	width: number
	height: number
	elapsed: SharedValue<number>
	/** 负数表示逆时针。 */
	period: number
}

function useTransitionColors(first: string, second: string, duration: number) {
	const startColor = useSharedValue(first)
	const endColor = useSharedValue(second)

	useEffect(() => {
		const config = { duration, easing: Easing.inOut(Easing.quad) }
		// withTiming 从当前显示颜色继续，快速切歌时也不会跳回上首歌的起点。
		startColor.set(withTiming(first, config))
		endColor.set(withTiming(second, config))

		return () => {
			cancelAnimation(startColor)
			cancelAnimation(endColor)
		}
	}, [first, second, duration, startColor, endColor])

	return useDerivedValue(() => [startColor.value, endColor.value])
}

function RotatingGradient({
	colors,
	width,
	height,
	elapsed,
	period,
}: RotatingGradientProps) {
	// 只旋转着色器端点，渐变长度与原版一样为高度。
	const start = useDerivedValue(() => {
		const angle = (elapsed.value / period) * Math.PI * 2

		return {
			x: width / 2 + (Math.sin(angle) * height) / 2,
			y: height / 2 - (Math.cos(angle) * height) / 2,
		}
	})

	const end = useDerivedValue(() => ({
		x: width - start.value.x,
		y: height - start.value.y,
	}))

	return (
		<LinearGradient
			start={start}
			end={end}
			colors={colors}
			mode='clamp'
		/>
	)
}

/**
 * 两层独立旋转的线性渐变，通过第三层 alpha 渐变混合。
 * <FluidBackground palette={palette} paused={!isVisible} />
 * <FluidBackground colors={['#FF0000', '#FFFF00', '#FF00FF', '#00FF00']} />
 */
export function FluidBackground({
	palette,
	colors,
	fallbackColor = '#202124',
	colorScheme,
	paused = false,
	transitionDuration = 800,
	flowTransitionDuration = 600,
	style,
}: FluidBackgroundProps) {
	const [size, setSize] = useState({ width: 0, height: 0 })

	const [isAppActive, setIsAppActive] = useState(
		AppState.currentState === 'active',
	)

	const initialReducedMotion = useReducedMotion()
	const [reducedMotion, setReducedMotion] = useState(initialReducedMotion)
	const elapsed = useSharedValue(globalFlowElapsed())
	// 流动速度倍率：暂停时缓动到 0，恢复时缓动到 1。
	const flowSpeed = useSharedValue(paused ? 0 : 1)
	const [isFlowEasing, setIsFlowEasing] = useState(false)
	const systemColorScheme = useColorScheme()

	const resolvedColors =
		colors ??
		getFluidBackgroundColors(palette, {
			fallbackColor,
			colorScheme:
				colorScheme ?? (systemColorScheme === 'light' ? 'light' : 'dark'),
		})

	const hasSize = size.width > 0 && size.height > 0

	const duration =
		paused ||
		!isAppActive ||
		reducedMotion ||
		!Number.isFinite(transitionDuration)
			? 0
			: Math.max(0, transitionDuration)

	const colorsA = useTransitionColors(
		resolvedColors[0],
		resolvedColors[1],
		duration,
	)

	const colorsB = useTransitionColors(
		resolvedColors[2],
		resolvedColors[3],
		duration,
	)

	useEffect(() => {
		let motionChanged = false

		const appSubscription = AppState.addEventListener('change', (state) => {
			setIsAppActive(state === 'active')
		})

		const motionSubscription = AccessibilityInfo.addEventListener(
			'reduceMotionChanged',
			(value) => {
				motionChanged = true
				setReducedMotion(value)
			},
		)

		// useReducedMotion 是应用启动时的快照；补查挂载时的实际系统设置。
		void AccessibilityInfo.isReduceMotionEnabled().then(
			(value) => {
				if (!motionChanged) setReducedMotion(value)
			},
			() => {},
		)

		return () => {
			motionChanged = true
			appSubscription.remove()
			motionSubscription.remove()
		}
	}, [])

	const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
		// 180 秒是三个周期的公倍数，回绕时三层均无视觉跳变。
		elapsed.set(
			(elapsed.value + (timeSincePreviousFrame ?? 0) * flowSpeed.value) %
				FLOW_WRAP_MS,
		)
	}, false)

	useEffect(() => {
		const config = {
			duration: Math.max(0, flowTransitionDuration),
			easing: Easing.inOut(Easing.quad),
		}

		if (paused) {
			// 先保持帧回调运行，等速度缓动到 0 后再停，避免流动骤停。
			setIsFlowEasing(true)
			flowSpeed.set(
				withTiming(0, config, (finished) => {
					if (finished) scheduleOnRN(setIsFlowEasing, false)
				}),
			)
		} else {
			flowSpeed.set(withTiming(1, config))
		}
	}, [paused, flowTransitionDuration, flowSpeed])

	useEffect(() => {
		frame.setActive(
			hasSize && isAppActive && !reducedMotion && (!paused || isFlowEasing),
		)

		return () => frame.setActive(false)
	}, [frame, hasSize, isAppActive, paused, reducedMotion, isFlowEasing])

	return (
		<View
			pointerEvents='none'
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility='no-hide-descendants'
			style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}
			onLayout={({ nativeEvent: { layout } }) => {
				setSize((previous) =>
					previous.width === layout.width && previous.height === layout.height
						? previous
						: { width: layout.width, height: layout.height },
				)
			}}
		>
			{hasSize && (
				<Canvas style={StyleSheet.absoluteFill}>
					<Fill>
						{FLUID_SHADER ? (
							<Shader
								source={FLUID_SHADER}
								uniforms={{ pixelRatio: PixelRatio.get() }}
							>
								<RotatingGradient
									{...size}
									elapsed={elapsed}
									period={FLOW_PERIOD_A_MS}
									colors={colorsA}
								/>
								<RotatingGradient
									{...size}
									elapsed={elapsed}
									period={FLOW_PERIOD_B_MS}
									colors={colorsB}
								/>
								<RotatingGradient
									{...size}
									elapsed={elapsed}
									period={FLOW_PERIOD_MASK_MS}
									colors={['#FFFFFFFF', '#FFFFFF00']}
								/>
							</Shader>
						) : (
							<RotatingGradient
								{...size}
								elapsed={elapsed}
								period={FLOW_PERIOD_A_MS}
								colors={colorsA}
							/>
						)}
					</Fill>
				</Canvas>
			)}
		</View>
	)
}
