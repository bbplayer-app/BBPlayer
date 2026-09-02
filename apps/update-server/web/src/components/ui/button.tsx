import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const variants = cva(
	'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-zinc-950 text-white hover:bg-zinc-800',
				secondary: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200',
				ghost: 'hover:bg-zinc-100 text-zinc-600',
			},
			size: { default: 'h-10 px-4', icon: 'size-10' },
		},
		defaultVariants: { variant: 'default', size: 'default' },
	},
)
export function Button({
	className,
	variant,
	size,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
	return (
		<button
			className={cn(variants({ variant, size }), className)}
			{...props}
		/>
	)
}
