import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn, percent } from '@/lib/utils'

/** A KPI tile; `change` adds a badge with the change against the previous period. */
export function Stat({
	label,
	value,
	hint,
	change,
	invertChange = false,
	className,
}: {
	label: string
	value: ReactNode
	hint?: ReactNode
	change?: number
	invertChange?: boolean
	className?: string
}) {
	return (
		<div
			className={cn('min-w-0 rounded-xl border bg-card p-4 sm:p-5', className)}
		>
			<p className='truncate text-sm text-muted-foreground'>{label}</p>
			<div className='mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1'>
				<p className='text-2xl font-semibold tracking-tight tabular-nums'>
					{value}
				</p>
				{change !== undefined && Number.isFinite(change) && (
					<Change
						invert={invertChange}
						value={change}
					/>
				)}
			</div>
			{hint && <div className='mt-1 text-xs text-muted-foreground'>{hint}</div>}
		</div>
	)
}

export function Change({
	value,
	invert = false,
}: {
	value: number
	invert?: boolean
}) {
	const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight
	const good = invert ? value <= 0 : value >= 0

	return (
		<span
			className={cn(
				'inline-flex items-center rounded-md px-1 text-xs font-medium tabular-nums',
				good
					? 'bg-success/10 text-success'
					: 'bg-destructive/10 text-destructive',
			)}
		>
			<Icon className='size-3.5' />
			{percent(Math.abs(value))}
		</span>
	)
}

export function changeBetween(current: number, previous: number | undefined) {
	return previous ? (current - previous) / previous : undefined
}
