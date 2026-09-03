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
	if (!source || typeof source !== 'object') return '—'
	const value = (source as Record<string, unknown>).commit_sha
	return typeof value === 'string' && value ? value.slice(0, 7) : '—'
}

export function queryParam(name: string) {
	return new URLSearchParams(window.location.search).get(name) ?? ''
}
