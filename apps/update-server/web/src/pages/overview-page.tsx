import { useQuery } from '@tanstack/react-query'
import { Activity, Download, Radio, Users } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

import { channels, groups, insights, service } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
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
import { chartDate, formatDate, number, percent } from '@/lib/utils'

const serviceChart = {
	requests: { label: 'Requests', color: 'var(--chart-2)' },
	errors: { label: 'Errors', color: 'var(--destructive)' },
} satisfies ChartConfig

export function OverviewPage() {
	const insightQuery = useQuery({ queryKey: ['insights'], queryFn: insights })
	const serviceQuery = useQuery({ queryKey: ['service'], queryFn: service })
	const channelQuery = useQuery({ queryKey: ['channels'], queryFn: channels })
	const groupQuery = useQuery({ queryKey: ['groups'], queryFn: groups })
	const queries = [insightQuery, serviceQuery, channelQuery, groupQuery]

	if (queries.some((query) => query.isPending))
		return (
			<AppShell active='overview'>
				<PageSkeleton />
			</AppShell>
		)
	const failed = queries.find((query) => query.error)
	if (failed)
		return (
			<AppShell active='overview'>
				<ErrorState
					error={failed.error}
					retry={() => void failed.refetch()}
				/>
			</AppShell>
		)

	const summary = insightQuery.data!.summary
	const latest = groupQuery.data!.slice(0, 5)
	return (
		<AppShell active='overview'>
			<PageHeader
				title='Overview'
				description="A current view of BBPlayer's OTA delivery health and recent releases."
			/>
			<div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
				<Metric
					icon={Users}
					label='Unique users'
					value={number(summary.unique_users)}
					hint='Active installations, last 7 days'
				/>
				<Metric
					icon={Download}
					label='Downloads'
					value={number(summary.downloads)}
					hint='Full + patch bundles, last 7 days'
				/>
				<Metric
					icon={Radio}
					label='Channels'
					value={number(channelQuery.data!.length)}
				/>
				<Metric
					icon={Activity}
					label='Launch failure rate'
					value={percent(summary.launch_failure_rate)}
					hint='Client-reported, last 7 days'
				/>
			</div>
			<div className='mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]'>
				<Card>
					<CardHeader>
						<CardTitle>Service activity</CardTitle>
						<CardDescription>
							Requests and server errors over the last seven days.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{serviceQuery.data!.series.length === 0 ? (
							<EmptyState
								title='No service activity'
								description='Request and error metrics will appear after the update service receives traffic.'
							/>
						) : (
							<ChartContainer
								className='h-72 w-full'
								config={serviceChart}
							>
								<LineChart
									accessibilityLayer
									data={serviceQuery.data!.series}
									margin={{ left: 8, right: 8 }}
								>
									<CartesianGrid vertical={false} />
									<XAxis
										axisLine={false}
										dataKey='minute'
										minTickGap={42}
										tickFormatter={chartDate}
										tickLine={false}
									/>
									<ChartTooltip
										content={
											<ChartTooltipContent
												labelFormatter={(value) => formatDate(String(value))}
											/>
										}
									/>
									<Line
										dataKey='requests'
										dot={false}
										stroke='var(--color-requests)'
										strokeWidth={2}
										type='monotone'
									/>
									<Line
										dataKey='errors'
										dot={false}
										stroke='var(--color-errors)'
										strokeDasharray='5 4'
										strokeWidth={2}
										type='monotone'
									/>
									<ChartLegend content={<ChartLegendContent />} />
								</LineChart>
							</ChartContainer>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Delivery mix</CardTitle>
						<CardDescription>
							How clients received launch bundles over the last seven days.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-5'>
						<Fact
							label='Full bundle requests'
							value={number(insightQuery.data!.transport.full_requests)}
						/>
						<Fact
							label='Bsdiff requests'
							value={number(insightQuery.data!.transport.bsdiff_requests)}
						/>
						<Fact
							label='Bsdiff hit rate'
							value={percent(insightQuery.data!.transport.bsdiff_hit_rate)}
						/>
					</CardContent>
				</Card>
			</div>
			<section className='mt-8'>
				<div className='mb-3 flex items-end justify-between gap-4'>
					<div>
						<h2 className='text-lg font-semibold'>Recent update groups</h2>
						<p className='mt-1 text-sm text-muted-foreground'>
							The newest releases across all channels.
						</p>
					</div>
					<a
						className='text-sm font-medium underline-offset-4 hover:underline'
						href='/updates/'
					>
						View all
					</a>
				</div>
				{latest.length === 0 ? (
					<EmptyState
						title='No update groups'
						description='Published OTA releases will appear here.'
					/>
				) : (
					<div className='overflow-hidden rounded-xl border'>
						<Table className='table-fixed'>
							<TableHeader>
								<TableRow>
									<TableHead>Update</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead className='hidden sm:table-cell'>
										Runtime
									</TableHead>
									<TableHead className='hidden lg:table-cell'>
										Published
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{latest.map((group) => (
									<TableRow key={group.id}>
										<TableCell className='w-[68%] max-w-0'>
											<a
												className='block truncate font-medium hover:underline'
												href={`/updates/detail.html?id=${encodeURIComponent(group.id)}`}
												title={group.message || 'Untitled update'}
											>
												{group.message || 'Untitled update'}
											</a>
										</TableCell>
										<TableCell className='w-[32%] truncate'>
											{group.channel || '—'}
										</TableCell>
										<TableCell className='hidden font-mono text-xs sm:table-cell'>
											{group.runtime_version}
										</TableCell>
										<TableCell className='hidden text-muted-foreground lg:table-cell'>
											{formatDate(group.created_at)}
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

function Metric({
	icon: Icon,
	label,
	value,
	hint,
}: {
	icon: typeof Users
	label: string
	value: string
	hint?: string
}) {
	return (
		<Card>
			<CardContent className='flex items-start justify-between p-5'>
				<div>
					<p className='text-sm text-muted-foreground'>{label}</p>
					<p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
					{hint && <p className='mt-1 text-xs text-muted-foreground'>{hint}</p>}
				</div>
				<div className='rounded-lg bg-muted p-2'>
					<Icon className='size-4' />
				</div>
			</CardContent>
		</Card>
	)
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className='flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0'>
			<span className='text-sm text-muted-foreground'>{label}</span>
			<span className='font-medium tabular-nums'>{value}</span>
		</div>
	)
}
