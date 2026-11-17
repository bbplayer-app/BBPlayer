import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function shortID(value: string) {
	return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

export function formatDate(value: string) {
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value))
}

export function chartDate(value: string) {
	return new Intl.DateTimeFormat('en', {
		month: 'short',
		day: 'numeric',
	}).format(new Date(value))
}

export function number(value: number) {
	return new Intl.NumberFormat('en-US').format(value)
}

export function bytes(value: number) {
	const megabytes = value >= 1024 * 1024

	return new Intl.NumberFormat('en-US', {
		style: 'unit',
		unit: megabytes ? 'megabyte' : 'kilobyte',
		unitDisplay: 'short',
		maximumFractionDigits: 2,
	}).format(value / (megabytes ? 1024 * 1024 : 1024))
}

export function percent(value: number) {
	return new Intl.NumberFormat('en-US', {
		style: 'percent',
		maximumFractionDigits: 1,
	}).format(value)
}

export function sourceCommit(source: unknown) {
	const value = sourceCommitSha(source)

	return value ? value.slice(0, 7) : '—'
}

export function sourceCommitSha(source: unknown) {
	if (!source || typeof source !== 'object') return ''
	const value = (source as Record<string, unknown>).commit_sha

	return typeof value === 'string' && value ? value : ''
}

export function sourceCommitURL(source: unknown) {
	const sha = sourceCommitSha(source)

	return sha ? `https://github.com/bbplayer-app/BBPlayer/commit/${sha}` : ''
}

export function queryParam(name: string) {
	return new URLSearchParams(window.location.search).get(name) ?? ''
}

const repositoryURL = 'https://github.com/bbplayer-app/BBPlayer'

export function commitURL(sha: string) {
	return sha ? `${repositoryURL}/commit/${sha}` : ''
}

export function compareURL(from: string, to: string) {
	return from && to && from !== to
		? `${repositoryURL}/compare/${from}...${to}`
		: ''
}

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['week', 7 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600],
	['minute', 60],
]

export function relativeTime(value: string) {
	const seconds = (new Date(value).getTime() - Date.now()) / 1000

	for (const [unit, size] of relativeUnits) {
		if (Math.abs(seconds) >= size)
			return relativeFormat.format(Math.round(seconds / size), unit)
	}

	return 'just now'
}

// Telemetry days are UTC calendar days; format them in UTC so they never shift a day.
const utcDayFormat = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC',
})

const utcLongDayFormat = new Intl.DateTimeFormat('en', {
	dateStyle: 'medium',
	timeZone: 'UTC',
})

export const dayLabel = (day: string) => utcDayFormat.format(new Date(day))

export const longDayLabel = (day: string) =>
	utcLongDayFormat.format(new Date(day))

export function addDays(day: string, days: number) {
	const date = new Date(day)
	date.setUTCDate(date.getUTCDate() + days)

	return date.toISOString().slice(0, 10)
}

export function ratio(part: number, whole: number) {
	return whole > 0 ? part / whole : 0
}
