import { AlertCircle, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton() {
	return (
		<div
			className='space-y-4'
			aria-label='Loading'
			aria-live='polite'
			role='status'
		>
			<Skeleton className='h-9 w-52' />
			<Skeleton className='h-5 w-full max-w-lg' />
			<Skeleton className='mt-8 h-72 w-full' />
		</div>
	)
}

export function ErrorState({
	error,
	retry,
}: {
	error: unknown
	retry?: () => void
}) {
	return (
		<div
			className='flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center'
			aria-live='assertive'
			role='alert'
		>
			<AlertCircle className='mb-3 size-6 text-destructive' />
			<h2 className='font-medium'>Unable to load this page</h2>
			<p className='mt-1 max-w-md text-sm text-muted-foreground'>
				{error instanceof Error
					? error.message
					: 'The server returned an unexpected response.'}
			</p>
			{retry && (
				<Button
					className='mt-5'
					onClick={retry}
					variant='outline'
				>
					Try again
				</Button>
			)}
		</div>
	)
}

export function EmptyState({
	title,
	description,
}: {
	title: string
	description: string
}) {
	return (
		<div className='flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center'>
			<Inbox className='mb-3 size-6 text-muted-foreground' />
			<h2 className='font-medium'>{title}</h2>
			<p className='mt-1 max-w-md text-sm text-muted-foreground'>
				{description}
			</p>
		</div>
	)
}
