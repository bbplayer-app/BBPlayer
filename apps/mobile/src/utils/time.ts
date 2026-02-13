// oxlint-disable-next-line import/no-unassigned-import
import 'dayjs/locale/zh-cn'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/**
 * 获取传入时间到现在的相对时间
 * @param date 时间戳或 Date 对象
 * @returns 相对时间
 */
export function formatRelativeTime(date: Date | string | number): string {
	return dayjs(date).fromNow()
}

/**
 * 格式化秒数为 (HH:)MM:SS 格式
 * @param seconds
 * @returns
 */
export const formatDurationToHHMMSS = (seconds: number): string => {
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const remainingSeconds = seconds % 60
	if (hours === 0) {
		return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
	}
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

/**
 * Parse duration string (e.g., "03:45", "1:30:00") to seconds
 * @param durationStr
 * @returns seconds
 */
export function parseDurationString(durationStr: string): number {
	const parts = durationStr.split(':').map(Number)
	if (parts.length === 3) {
		return parts[0] * 3600 + parts[1] * 60 + parts[2]
	} else if (parts.length === 2) {
		return parts[0] * 60 + parts[1]
	}
	return 0
}

/**
 * MM:SS 格式转换为秒数
 * @param duration
 * @returns
 * @deprecated Use parseDurationString instead
 */
export const formatMMSSToSeconds = parseDurationString
