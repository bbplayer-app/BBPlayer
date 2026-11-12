import type { AbLoopRange } from '@bbplayer/orpheus'
import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import AnimateableText from 'react-native-animateable-text'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedProps,
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'

import { moveAbLoopPoint } from '@/lib/player/abLoopDraft'
import { formatDurationToHHMMSS } from '@/utils/time'

function formatPoint(value: number, decimals = 3) {
	'worklet'
	const scale = 10 ** decimals
	const ticks = Math.round(
		Math.max(0, Number.isFinite(value) ? value : 0) * scale,
	)
	return (
		formatDurationToHHMMSS(Math.floor(ticks / scale)) +
		'.' +
		String(ticks % scale).padStart(decimals, '0')
	)
}

type Commit = (
	point: 'start' | 'end',
	value: number,
	range?: AbLoopRange,
) => void | AbLoopRange | Promise<void | AbLoopRange>

function Thumb({
	start,
	end,
	point,
	displayValue,
	duration,
	width,
	active,
	committing,
	isRange,
	disabled,
	onCommit,
}: {
	start: SharedValue<number>
	end: SharedValue<number>
	point: 'start' | 'end'
	displayValue: number
	duration: number
	width: SharedValue<number>
	active: SharedValue<number>
	committing: SharedValue<boolean>
	isRange: boolean
	disabled: boolean
	onCommit: Commit
}) {
	const { colors } = useTheme()
	const value = point === 'start' ? start : end
	const label = isRange ? (point === 'start' ? 'A' : 'B') : '播放进度'
	const id = point === 'start' ? 1 : 2
	const origin = useSharedValue(0)
	const originalStart = useSharedValue(0)
	const originalEnd = useSharedValue(0)
	const update = (next: number) => {
		'worklet'
		if (isRange) {
			const range = moveAbLoopPoint(
				{ start: start.value, end: end.value },
				point,
				next,
				duration,
			)
			start.set(range.start)
			end.set(range.end)
		} else {
			value.set(Math.max(0, Math.min(duration, next)))
		}
	}
	const gesture = usePanGesture({
		enabled: !disabled,
		activeOffsetX: [-3, 3],
		failOffsetY: [-15, 15],
		maxPointers: 1,
		onActivate: () => {
			'worklet'
			if (active.value !== 0 || committing.value) return
			originalStart.set(start.value)
			originalEnd.set(end.value)
			origin.set(value.value)
			active.set(id)
		},
		onUpdate: (event) => {
			'worklet'
			if (active.value !== id || width.value <= 0) return
			// 连续手势仅更新 UI 线程的临时值，不进入 React、草稿或播放器。
			update(origin.value + (event.translationX / width.value) * duration)
		},
		onDeactivate: (event) => {
			'worklet'
			if (active.value !== id) return
			if (event.canceled) {
				start.set(originalStart.value)
				end.set(originalEnd.value)
			} else {
				committing.set(true)
				scheduleOnRN(
					onCommit,
					point,
					value.value,
					isRange ? { start: start.value, end: end.value } : undefined,
				)
			}
			active.set(0)
		},
	})
	const style = useAnimatedStyle(() => ({
		transform: [
			{
				translateX:
					Math.max(0, Math.min(1, value.value / (duration || 1))) * width.value,
			},
		],
	}))
	const adjust = (delta: number) => {
		if (active.get() !== 0 || committing.get()) return
		const next = isRange
			? moveAbLoopPoint(
					{ start: start.get(), end: end.get() },
					point,
					value.get() + delta,
					duration,
				)
			: undefined
		void onCommit(
			point,
			next?.[point] ?? Math.max(0, Math.min(duration, value.get() + delta)),
			next,
		)
	}
	return (
		<GestureDetector gesture={gesture}>
			<Animated.View
				style={[styles.thumbTarget, { top: point === 'end' ? 48 : 0 }, style]}
				accessible
				accessibilityRole='adjustable'
				accessibilityLabel={isRange ? `${label} 点` : label}
				accessibilityValue={{ min: 0, max: duration, now: displayValue }}
				accessibilityState={{ disabled }}
				accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
				onAccessibilityAction={(event) => {
					if (!disabled)
						adjust(event.nativeEvent.actionName === 'increment' ? 0.5 : -0.5)
				}}
				testID={`ab-loop-thumb-${label}`}
			>
				{isRange && (
					<View
						pointerEvents='none'
						style={{
							position: 'absolute',
							left: 21,
							top: point === 'start' ? 35 : -2,
							width: 2,
							height: 11,
							backgroundColor: disabled ? colors.outline : colors.primary,
						}}
					/>
				)}
				<View
					style={[
						styles.thumb,
						{ backgroundColor: disabled ? colors.outline : colors.primary },
					]}
				>
					{isRange && (
						<Text
							style={{ color: colors.onPrimary }}
							variant='labelMedium'
						>
							{label}
						</Text>
					)}
				</View>
			</Animated.View>
		</GestureDetector>
	)
}

/** 拖动状态与已提交草稿分离；A/B 触摸目标分居轨道上下方。 */
export default function AbLoopTimeline({
	duration,
	range,
	position = 0,
	disabled,
	onCommit,
}: {
	duration: number
	range?: AbLoopRange
	position?: number
	disabled: boolean
	onCommit: Commit
}) {
	const { colors, fonts } = useTheme()
	const width = useSharedValue(0)
	const start = useSharedValue(range?.start ?? position)
	const end = useSharedValue(range?.end ?? duration)
	const active = useSharedValue(0)
	const committing = useSharedValue(false)
	const externalStart = useSharedValue(range?.start ?? position)
	const externalEnd = useSharedValue(range?.end ?? duration)
	const live = useRef({ mounted: true, disabled, onCommit })
	useEffect(() => {
		live.current = { mounted: true, disabled, onCommit }
		return () => {
			live.current.mounted = false
		}
	}, [disabled, onCommit])
	useEffect(() => {
		externalStart.set(range?.start ?? position)
		externalEnd.set(range?.end ?? duration)
	}, [
		range?.start,
		range?.end,
		position,
		duration,
		disabled,
		externalStart,
		externalEnd,
	])
	useAnimatedReaction(
		() => ({
			start: externalStart.value,
			end: externalEnd.value,
			active: active.value,
			committing: committing.value,
		}),
		(next) => {
			// 播放进度、父组件重渲染及异步 seek 不得覆盖正在拖动/提交的位置。
			if (next.active !== 0 || next.committing) return
			start.set(next.start)
			end.set(next.end)
		},
	)
	const commit: Commit = async (point, value, next) => {
		let accepted: void | AbLoopRange
		try {
			if (live.current.mounted && !live.current.disabled)
				accepted = await live.current.onCommit(point, value, next)
		} finally {
			// 提交结果是显式确认，不等 React 的被动 effect 回传，避免松手回跳。
			scheduleOnUI(() => {
				'worklet'
				if (accepted) {
					externalStart.set(accepted.start)
					externalEnd.set(accepted.end)
				}
				committing.set(false)
			})
		}
	}
	const selectionStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX: ((range ? start.value : 0) / (duration || 1)) * width.value,
			},
		],
		width: Math.max(
			0,
			((range ? end.value - start.value : start.value) / (duration || 1)) *
				width.value,
		),
	}))
	const rangeText = useAnimatedProps(() => ({
		text: formatPoint(start.value, 1) + ' — ' + formatPoint(end.value, 1),
	}))
	const lengthText = useAnimatedProps(() => ({
		text: '区间时长：' + formatPoint(end.value - start.value, 1),
	}))
	const positionText = useAnimatedProps(() => ({
		text: formatPoint(start.value),
	}))
	const durationText = useAnimatedProps(() => ({ text: formatPoint(duration) }))
	const textStyle = {
		...fonts.bodyMedium,
		color: colors.onSurface,
		fontVariant: ['tabular-nums'] as const,
	}
	return (
		<View style={styles.container}>
			{range && (
				<>
					<AnimateableText
						testID='ab-loop-range'
						style={[textStyle, fonts.titleMedium, styles.rangeText]}
						animatedProps={rangeText}
					/>
					<AnimateableText
						style={[textStyle, styles.center]}
						animatedProps={lengthText}
					/>
				</>
			)}
			<View
				style={{ height: range ? 92 : 48 }}
				onLayout={(event) =>
					width.set(Math.max(0, event.nativeEvent.layout.width - 48))
				}
			>
				<View
					style={[
						styles.rail,
						{ top: range ? 44 : 22, backgroundColor: colors.surfaceVariant },
					]}
				/>
				<Animated.View
					style={[
						styles.selection,
						{
							top: range ? 44 : 22,
							backgroundColor: disabled ? colors.outline : colors.primary,
						},
						selectionStyle,
					]}
				/>
				<Thumb
					start={start}
					end={end}
					point='start'
					displayValue={range?.start ?? position}
					duration={duration}
					width={width}
					active={active}
					committing={committing}
					isRange={!!range}
					disabled={disabled}
					onCommit={commit}
				/>
				{range && (
					<Thumb
						start={start}
						end={end}
						point='end'
						displayValue={range.end}
						duration={duration}
						width={width}
						active={active}
						committing={committing}
						isRange
						disabled={disabled}
						onCommit={commit}
					/>
				)}
			</View>
			{!range && (
				<View style={styles.times}>
					<AnimateableText
						style={textStyle}
						animatedProps={positionText}
					/>
					<AnimateableText
						style={textStyle}
						animatedProps={durationText}
					/>
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { gap: 4 },
	rangeText: { textAlign: 'center', marginTop: 4 },
	center: { textAlign: 'center' },
	times: { flexDirection: 'row', justifyContent: 'space-between' },
	rail: {
		position: 'absolute',
		left: 24,
		right: 24,
		height: 4,
		borderRadius: 2,
	},
	selection: { position: 'absolute', left: 24, height: 4, borderRadius: 2 },
	thumbTarget: {
		position: 'absolute',
		left: 2,
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	thumb: {
		width: 26,
		height: 26,
		borderRadius: 13,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
