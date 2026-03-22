import dayjs, { type Dayjs } from 'dayjs'
import localeData from 'dayjs/plugin/localeData'
import weekday from 'dayjs/plugin/weekday'

import type { Day } from '../types'

dayjs.extend(localeData)
dayjs.extend(weekday)

export function getDaysInRange(startDate: Date, endDate: Date): Date[] {
	const start = dayjs(startDate).startOf('day')
	const end = dayjs(endDate).startOf('day')
	const days: Date[] = []
	let current = start

	while (current.isBefore(end) || current.isSame(end)) {
		days.push(current.toDate())
		current = current.add(1, 'day')
	}

	return days
}

export function getMonthlyData(startDate: Date, endDate: Date) {
	const start = dayjs(startDate).startOf('month')
	const end = dayjs(endDate).endOf('month')

	// Group days by month
	const months: { month: Date; days: Date[] }[] = []
	let current = start

	while (current.isBefore(end)) {
		const monthStart = current.startOf('month')
		const monthEnd = current.endOf('month')
		const days = getDaysInRange(monthStart.toDate(), monthEnd.toDate())
		months.push({ month: monthStart.toDate(), days })
		current = current.add(1, 'month')
	}

	return months
}

const getStartOfWeek = (date: Dayjs, startDay: Day) => {
	const day = date.day()
	const diff = (day < startDay ? 7 : 0) + day - startDay
	return date.subtract(diff, 'day').startOf('day')
}

export function getWeeklyData(
	startDate: Date,
	endDate: Date,
	weekStartsOn: Day = 0,
) {
	const startOfWeek = getStartOfWeek(dayjs(startDate), weekStartsOn)
	const end = dayjs(endDate).endOf('day')

	const weeks: { weekStart: Date; days: Date[] }[] = []
	let current = startOfWeek

	while (current.isBefore(end)) {
		const weekDays: Date[] = []
		for (let i = 0; i < 7; i++) {
			weekDays.push(current.add(i, 'day').toDate())
		}
		weeks.push({ weekStart: current.toDate(), days: weekDays })
		current = current.add(1, 'week')
	}

	return weeks
}

export function countData(
	data: (Date | string)[] | Record<string, number>,
): Record<string, number> {
	if (!Array.isArray(data)) {
		return data
	}

	const counts: Record<string, number> = {}
	data.forEach((item) => {
		const dateStr = dayjs(item).format('YYYY-MM-DD')
		counts[dateStr] = (counts[dateStr] || 0) + 1
	})

	return counts
}

export function getLevel(
	count: number,
	cellColor?: Record<number, string>,
): number {
	if (!cellColor) return 0
	const levels = Object.keys(cellColor)
		.map(Number)
		.sort((a, b) => b - a)
	for (const level of levels) {
		if (count >= level) {
			return level
		}
	}
	return 0
}

export function getColor(
	count: number,
	cellColor: Record<number, string>,
	defaultColor: string,
): string {
	const level = getLevel(count, cellColor)
	return level > 0 ? cellColor[level] : defaultColor
}
