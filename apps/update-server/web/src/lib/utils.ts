import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
export function shortID(value: string) {
	return value.length > 13 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}
export function date(value: string) {
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value))
}
export function number(value: number) {
	return new Intl.NumberFormat('en-US').format(value)
}
