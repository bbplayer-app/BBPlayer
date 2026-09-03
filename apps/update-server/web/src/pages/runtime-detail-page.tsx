import { useQuery } from '@tanstack/react-query'

import { runtime as getRuntime } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { formatDate, queryParam, sourceCommit } from '@/lib/utils'

export function RuntimeDetailPage() {
	const runtime = queryParam('runtime')
	const query = useQuery({
		queryKey: ['runtime', runtime],
		queryFn: () => getRuntime(runtime),
		enabled: Boolean(runtime),
	})
	if (!runtime)
		return (
			<AppShell active='runtimes'>
				<ErrorState error={new Error('No runtime was provided.')} />
			</AppShell>
		)
	if (query.isPending)
		return (
			<AppShell active='runtimes'>
				<PageSkeleton />
			</AppShell>
		)
	if (query.error)
		return (
			<AppShell active='runtimes'>
				<ErrorState
					error={query.error}
					retry={() => void query.refetch()}
				/>
			</AppShell>
		)
	const updates = query.data.updates
	const channels = query.data.channels
	const version = query.data.version
	return (
		<AppShell active='runtimes'>
			<PageHeader
				title={`Runtime ${version || runtime}`}
				parent={{ label: 'Runtimes', href: '/runtimes/' }}
				description='Update groups that share this native compatibility boundary.'
			/>
			<div className='mb-8 grid gap-4 sm:grid-cols-3'>
				<Summary
					label='Runtime version'
					value={runtime}
					mono
				/>
				<Summary
					label='App version'
					value={version || '—'}
				/>
				<Summary
					label='Channels'
					value={channels.join(', ') || 'Unlinked'}
				/>
			</div>
			<section>
				<h2 className='mb-3 text-lg font-semibold'>Updates</h2>
				{updates.length === 0 ? (
					<EmptyState
						title='No update groups'
						description='No recent update group uses this runtime.'
					/>
				) : (
					<div className='overflow-hidden rounded-xl border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Update</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead className='hidden sm:table-cell'>Commit</TableHead>
									<TableHead className='hidden lg:table-cell'>
										Published
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{updates.map((item) => (
									<TableRow key={item.id}>
										<TableCell>
											<a
												className='font-medium hover:underline'
												href={`/updates/detail.html?id=${encodeURIComponent(item.id)}`}
											>
												{item.message || 'Untitled update'}
											</a>
										</TableCell>
										<TableCell>
											<Badge variant='secondary'>
												{item.channel || 'Unlinked'}
											</Badge>
										</TableCell>
										<TableCell className='hidden font-mono text-xs sm:table-cell'>
											{sourceCommit(item.source)}
										</TableCell>
										<TableCell className='hidden text-muted-foreground lg:table-cell'>
											{formatDate(item.created_at)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</section>
		</AppShell>
	)
}

function Summary({
	label,
	value,
	mono = false,
}: {
	label: string
	value: string
	mono?: boolean
}) {
	return (
		<Card>
			<CardContent className='p-5'>
				<p className='text-sm text-muted-foreground'>{label}</p>
				<p
					className={`mt-2 break-all font-medium ${mono ? 'font-mono text-xs' : ''}`}
				>
					{value}
				</p>
			</CardContent>
		</Card>
	)
}
