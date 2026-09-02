import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<section
			className={cn(
				'overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm',
				className,
			)}
			{...props}
		/>
	)
}
