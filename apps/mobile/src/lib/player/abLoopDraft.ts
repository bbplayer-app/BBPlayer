import type { AbLoopRange } from '@bbplayer/orpheus'

/** 毫秒精度与原生 seek 一致；微调步长独立于区间最小长度。 */
export const AB_LOOP_MIN_GAP = 0.001

export function isAbLoopRangeValid(range: AbLoopRange, duration: number) {
	'worklet'
	return (
		Number.isFinite(duration) &&
		duration > 0 &&
		Number.isFinite(range.start) &&
		Number.isFinite(range.end) &&
		range.start >= 0 &&
		range.end - range.start >= AB_LOOP_MIN_GAP - 1e-9 &&
		range.end <= duration
	)
}

export function initialAbLoopRange(
	position: number,
	duration: number,
): AbLoopRange {
	const start = Math.min(
		Math.max(Number.isFinite(position) ? position : 0, 0),
		Math.max(0, duration - AB_LOOP_MIN_GAP),
	)
	return { start, end: Math.min(duration, start + 15) }
}

export function moveAbLoopPoint(
	range: AbLoopRange,
	point: 'start' | 'end',
	value: number,
	duration: number,
): AbLoopRange {
	'worklet'
	if (!Number.isFinite(value) || !isAbLoopRangeValid(range, duration))
		return range
	const rounded = Math.round(value * 1000) / 1000
	// 保持 A/B 的角色；越界时只推动相邻端点到满足最小间隔的位置。
	if (point === 'start') {
		const start = Math.max(0, Math.min(rounded, duration - AB_LOOP_MIN_GAP))
		return {
			start,
			end: Math.min(duration, Math.max(range.end, start + AB_LOOP_MIN_GAP)),
		}
	}
	const end = Math.max(AB_LOOP_MIN_GAP, Math.min(rounded, duration))
	return {
		start: Math.max(0, Math.min(range.start, end - AB_LOOP_MIN_GAP)),
		end,
	}
}
