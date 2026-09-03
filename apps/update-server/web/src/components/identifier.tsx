import { CheckIcon, CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, shortID } from '@/lib/utils'

export function Identifier({
	value,
	label = 'ID',
	className,
}: {
	value: string
	label?: string
	className?: string
}) {
	async function copy() {
		try {
			await navigator.clipboard.writeText(value)
			toast.success(`${label} copied`)
		} catch {
			toast.error(`Couldn't copy ${label.toLowerCase()}`)
		}
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					aria-label={`Copy ${label}: ${value}`}
					className={cn(
						'group inline-flex max-w-full items-center gap-1 rounded-sm font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
						className,
					)}
					onClick={() => void copy()}
					type='button'
				>
					<span className='truncate'>{shortID(value)}</span>
					<CopyIcon
						aria-hidden='true'
						className='size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100'
					/>
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<div className='flex items-center gap-2'>
					<CheckIcon
						aria-hidden='true'
						className='size-3'
					/>
					<span className='font-mono text-xs'>{value}</span>
				</div>
			</TooltipContent>
		</Tooltip>
	)
}
