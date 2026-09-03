import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { activity, channel } from '@/api'
import { AppShell } from '@/components/app-shell'
import { Identifier } from '@/components/identifier'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@/components/ui/chart'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { chartDate, formatDate, queryParam } from '@/lib/utils'

const config = {
	active_installations: {
		label: 'Active installations',
		color: 'var(--chart-2)',
	},
} satisfies ChartConfig

export function ChannelDetailPage() {
	const name = queryParam('channel')
	const channelQuery = useQuery({
		queryKey: ['channel', name],
		queryFn: () => channel(name),
		enabled: Boolean(name),
	})
	const [selectedRuntime, setSelectedRuntime] = useState('')
	const runtimes = channelQuery.data?.runtimes ?? []
	const runtime = runtimes.some(
		(item) => item.runtime_version === selectedRuntime,
	)
		? selectedRuntime
		: (runtimes[0]?.runtime_version ?? '')
	const activityQuery = useQuery({
		queryKey: ['activity', name, runtime],
		queryFn: () => activity(name, runtime),
		enabled: Boolean(name && runtime),
	})

	if (!name)
		return (
			<AppShell active='channels'>
				<ErrorState
					error={
						new Error(
							'No channel was provided. Return to Channels and choose one.',
						)
					}
				/>
			</AppShell>
		)
	if (channelQuery.isPending)
		return (
			<AppShell active='channels'>
				<PageSkeleton />
			</AppShell>
		)
	if (channelQuery.error)
		return (
			<AppShell active='channels'>
				<ErrorState
					error={channelQuery.error}
					retry={() => void channelQuery.refetch()}
				/>
			</AppShell>
		)
	return (
		<AppShell active='channels'>
			<PageHeader
				title={name}
				parent={{ label: 'Channels', href: '/channels/' }}
				description='Current runtime heads and active installations for this channel.'
			/>
			{runtimes.length === 0 ? (
				<EmptyState
					title='No runtime heads'
					description='This channel does not currently target an OTA or embedded update.'
				/>
			) : (
				<>
					<Tabs
						className='mb-6'
						onValueChange={setSelectedRuntime}
						value={runtime}
					>
						<TabsList className='h-auto max-w-full justify-start overflow-x-auto'>
							<>
								{runtimes.map((item) => (
									<TabsTrigger
										key={item.runtime_version}
										value={item.runtime_version}
									>
										{item.version || item.runtime_version}
									</TabsTrigger>
								))}
							</>
						</TabsList>
					</Tabs>
					<Card>
						<CardHeader>
							<CardTitle>Active installations</CardTitle>
							<CardDescription>
								Daily unique installations reporting this runtime on {name},
								over the last seven days.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{activityQuery.isPending ? (
								<div className='h-72 animate-pulse rounded-lg bg-muted' />
							) : activityQuery.error ? (
								<ErrorState
									error={activityQuery.error}
									retry={() => void activityQuery.refetch()}
								/>
							) : activityQuery.data.series.length === 0 ? (
								<EmptyState
									title='No activity yet'
									description='Client activity will appear after installations report telemetry.'
								/>
							) : (
								<ChartContainer
									className='h-72 w-full'
									config={config}
								>
									<LineChart
										accessibilityLayer
										data={activityQuery.data.series}
										margin={{ left: 4, right: 12 }}
									>
										<CartesianGrid vertical={false} />
										<XAxis
											axisLine={false}
											dataKey='day'
											minTickGap={36}
											tickFormatter={chartDate}
											tickLine={false}
										/>
										<YAxis
											axisLine={false}
											tickLine={false}
											width={36}
										/>
										<ChartTooltip
											content={
												<ChartTooltipContent
													labelFormatter={(value) => chartDate(String(value))}
												/>
											}
										/>
										<Line
											dataKey='active_installations'
											dot={false}
											stroke='var(--color-active_installations)'
											strokeWidth={2}
											type='monotone'
										/>
									</LineChart>
								</ChartContainer>
							)}
						</CardContent>
					</Card>
					<section className='mt-8'>
						<h2 className='mb-3 text-lg font-semibold'>Runtime heads</h2>
						<div className='overflow-hidden rounded-xl border'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Runtime</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className='hidden sm:table-cell'>
											Platforms
										</TableHead>
										<TableHead className='hidden lg:table-cell'>
											Head group
										</TableHead>
										<TableHead className='hidden xl:table-cell'>
											Updated
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{runtimes.map((item) => (
										<TableRow key={item.runtime_version}>
											<TableCell>
												<a
													className='font-medium hover:underline'
													href={`/runtimes/detail.html?runtime=${encodeURIComponent(item.runtime_version)}`}
												>
													{item.version || item.runtime_version}
												</a>
												<p className='mt-1 font-mono text-xs text-muted-foreground'>
													{item.runtime_version}
												</p>
											</TableCell>
											<TableCell>
												<StatusBadge value={item.mode} />
											</TableCell>
											<TableCell className='hidden capitalize sm:table-cell'>
												{item.platforms.join(', ')}
											</TableCell>
											<TableCell className='hidden font-mono text-xs lg:table-cell'>
												{item.head_group_id ? (
													<Identifier
														label='head group ID'
														value={item.head_group_id}
													/>
												) : (
													'Embedded'
												)}
											</TableCell>
											<TableCell className='hidden text-muted-foreground xl:table-cell'>
												{formatDate(item.updated_at)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</section>
				</>
			)}
		</AppShell>
	)
}
