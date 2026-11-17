import type { PatchStatus, Platform } from '@/api'
import { Badge } from '@/components/ui/badge'
import { cn, percent, ratio } from '@/lib/utils'

// Below this many known launches a crash rate is too noisy to color.
const minimumLaunchesForHealth = 20

export function LiveBadge({ className }: { className?: string }) {
	return (
		<Badge
			className={cn(
				'gap-1.5 bg-success/12 text-success dark:bg-success/20',
				className,
			)}
		>
			<span className='relative flex size-1.5'>
				<span className='absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60' />
				<span className='relative inline-flex size-1.5 rounded-full bg-success' />
			</span>
			Live
		</Badge>
	)
}

export function HeadModeBadge({ mode }: { mode: '' | 'ota' | 'embedded' }) {
	if (mode === 'ota') return <LiveBadge />

	return (
		<Badge variant='secondary'>
			{mode === 'embedded' ? 'Embedded bundle' : 'No OTA update'}
		</Badge>
	)
}

export function PlatformLabel({ platform }: { platform: Platform }) {
	return (
		<span className='text-xs text-muted-foreground'>
			{platform === 'ios' ? 'iOS' : 'Android'}
		</span>
	)
}

export function crashTone(crashes: number, launches: number) {
	if (launches < minimumLaunchesForHealth) return 'muted'
	const rate = crashes / launches

	return rate >= 0.02 ? 'bad' : rate >= 0.005 ? 'warn' : 'good'
}

export function CrashRate({
	crashes,
	launches,
	className,
}: {
	crashes: number
	launches: number
	className?: string
}) {
	if (launches === 0)
		return <span className={cn('text-muted-foreground', className)}>—</span>

	const tone = crashTone(crashes, launches)

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 tabular-nums',
				tone === 'bad' && 'text-destructive',
				tone === 'warn' && 'text-warning',
				className,
			)}
			title={`${crashes} crashes out of ${launches} known launches`}
		>
			<span
				className={cn(
					'size-1.5 rounded-full',
					tone === 'good' && 'bg-success',
					tone === 'warn' && 'bg-warning',
					tone === 'bad' && 'bg-destructive',
					tone === 'muted' && 'bg-muted-foreground/40',
				)}
			/>
			{percent(ratio(crashes, launches))}
		</span>
	)
}

const patchStatus = {
	pending: {
		label: 'Queued',
		className: 'bg-secondary text-secondary-foreground',
	},
	processing: { label: 'Generating', className: 'bg-brand/12 text-brand' },
	ready: { label: 'Ready', className: 'bg-success/12 text-success' },
	failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
	not_beneficial: {
		label: 'Not beneficial',
		className: 'bg-secondary text-muted-foreground',
	},
} satisfies Record<PatchStatus, { label: string; className: string }>

export function PatchStatusBadge({ status }: { status: PatchStatus }) {
	return (
		<Badge className={patchStatus[status].className}>
			{patchStatus[status].label}
		</Badge>
	)
}
