import { useQuery } from '@tanstack/react-query'

import {
	heads as fetchChannelHeads,
	headGroupID,
	runtime as getRuntime,
	type Head,
} from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
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
import { formatDate, queryParam, shortID, sourceCommit } from '@/lib/utils'

export function RuntimeDetailPage() {
	const runtime = queryParam('runtime')
	const query = useQuery({
		queryKey: ['runtime', runtime],
		queryFn: () => getRuntime(runtime),
		enabled: Boolean(runtime),
	})
	const channelsKey = query.data?.channels.join('\u0000') ?? ''
	const headsQuery = useQuery({
		queryKey: ['runtimeHeads', runtime, channelsKey],
		queryFn: async () => {
			const list = query.data?.channels ?? []
			const rows = (
				await Promise.all(
					list.map(async (channel) => {
						const items = await fetchChannelHeads(channel)
						return items.map(
							(item) => ({ ...item, channel }) as Head & { channel: string },
						)
					}),
				)
			).flat()
			return rows.filter((item) => item.runtime_version === runtime)
		},
		enabled: Boolean(runtime && channelsKey),
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
			<section className='mb-8'>
				<h2 className='mb-3 text-lg font-semibold'>Current heads</h2>
				{headsQuery.isPending ? (
					<PageSkeleton />
				) : headsQuery.isError || (headsQuery.data?.length ?? 0) === 0 ? (
					<EmptyState
						title='No live heads'
						description={
							headsQuery.isError
								? headsQuery.error.message
								: 'No channel currently points at an OTA update for this runtime.'
						}
					/>
				) : (
					<div className='overflow-hidden rounded-xl border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Channel</TableHead>
									<TableHead>Platform</TableHead>
									<TableHead>Head</TableHead>
									<TableHead className='hidden text-muted-foreground sm:table-cell'>
										Updated
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{headsQuery.data
									.slice()
									.sort((a, b) =>
										a.channel === b.channel
											? a.platform.localeCompare(b.platform)
											: a.channel.localeCompare(b.channel),
									)
									.map((item) => (
										<TableRow key={`${item.channel}-${item.platform}`}>
											<TableCell>
												<Badge variant='secondary'>{item.channel}</Badge>
											</TableCell>
											<TableCell className='capitalize'>
												{item.platform}
											</TableCell>
											<TableCell>
												{item.mode === 'embedded' ? (
													<StatusBadge value='embedded' />
												) : (
													<a
														className='font-mono text-xs text-muted-foreground hover:text-foreground hover:underline'
														href={`/updates/detail.html?id=${encodeURIComponent(headGroupID(item) ?? '')}`}
														title='Head update group'
													>
														{headGroupID(item)
															? shortID(headGroupID(item) ?? '')
															: '—'}
													</a>
												)}
											</TableCell>
											<TableCell className='hidden text-muted-foreground sm:table-cell'>
												{formatDate(item.updated_at)}
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>
				)}
			</section>
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
									<TableHead className='hidden md:table-cell'>Head</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{updates.map((item) => {
									const headPlatforms = headsQuery.data
										?.filter(
											(head) =>
												head.channel === item.channel &&
												headGroupID(head) === item.id,
										)
										.map((head) => head.platform)
									return (
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
											<TableCell className='hidden md:table-cell'>
												{headPlatforms && headPlatforms.length > 0 ? (
													<Badge
														variant='outline'
														className='capitalize'
													>
														{headPlatforms.join(' + ')}
													</Badge>
												) : (
													<span className='text-xs text-muted-foreground'>
														—
													</span>
												)}
											</TableCell>
										</TableRow>
									)
								})}
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
