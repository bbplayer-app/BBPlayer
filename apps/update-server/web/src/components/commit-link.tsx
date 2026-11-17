import { GitCommitHorizontal } from 'lucide-react'

import { cn, commitURL } from '@/lib/utils'

export function CommitLink({
	sha,
	className,
}: {
	sha: string
	className?: string
}) {
	if (!sha) return <span className='text-muted-foreground'>—</span>

	return (
		<a
			className={cn(
				'inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-brand',
				className,
			)}
			href={commitURL(sha)}
			rel='noreferrer'
			target='_blank'
			title={sha}
		>
			<GitCommitHorizontal className='size-3.5' />
			{sha.slice(0, 7)}
		</a>
	)
}
