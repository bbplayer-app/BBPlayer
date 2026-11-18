import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, XAxis } from 'recharts'

import {
	audience,
	insights,
	overview,
	service,
	type FleetRow,
	type HistoryEntry,
} from '@/api'
import { AppShell } from '@/components/app-shell'
import { CrashRate, crashTone, PlatformLabel } from '@/components/badges'
import { CommitLink } from '@/components/commit-link'
import { HistoryList } from '@/components/history-list'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { changeBetween, Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardAction,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	bytes,
	cn,
	formatDate,
	number,
	percent,
	ratio,
	relativeTime,
} from '@/lib/utils'

const serviceChart = {
	requests: { label: 'Requests', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function OverviewPage() {
	const overviewQuery = useQuery({ queryKey: ['overview'], queryFn: overview })

	const audienceQuery = useQuery({
		queryKey: ['audience', 7, ''],
		queryFn: () => audience(7, ''),
	})

	const insightQuery = useQuery({ queryKey: ['insights'], queryFn: insights })

	if (overviewQuery.isPending)
		return (
			<AppShell active='overview'>
				<PageSkeleton />
			</AppShell>
		)

	if (overviewQuery.error)
		return (
			<AppShell active='overview'>
				<ErrorState
					error={overviewQuery.error}
					retry={() => void overviewQuery.refetch()}
				/>
			</AppShell>
		)

	const { fleet, history, patches } = overviewQuery.data
	const current = audienceQuery.data?.current
	const previous = audienceQuery.data?.previous
	const transport = insightQuery.data?.transport
	const summary = insightQuery.data?.summary

	return (
		<AppShell active='overview'>
			<PageHeader
				title='Overview'
				description='What each native version is running right now, how far the live update has spread, and whether it is healthy.'
			/>
			<Attention
				fleet={fleet}
				patches={patches}
			/>
			<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
				<Stat
					change={
						current &&
						changeBetween(current.active_users, previous?.active_users)
					}
					hint='Distinct devices, last 7 days'
					label='Active devices'
					value={current ? number(current.active_users) : '—'}
				/>
				<Stat
					change={
						current &&
						changeBetween(current.active_user_days, previous?.active_user_days)
					}
					hint='Average over the last 7 days'
					label='Daily active'
					value={
						current ? number(Math.round(current.active_user_days / 7)) : '—'
					}
				/>
				<Stat
					hint={
						summary
							? `${number(summary.launch_failures)} of ${number(summary.launch_successes + summary.launch_failures)} launches, 7 days`
							: 'Client-reported, 7 days'
					}
					label='Launch failure rate'
					value={summary ? percent(summary.launch_failure_rate) : '—'}
				/>
				<Stat
					hint={
						transport
							? `${percent(transport.bsdiff_hit_rate)} of updates served as patches`
							: 'bsdiff patches, 7 days'
					}
					label='Bandwidth saved'
					value={
						transport ? bytes(Math.max(transport.bsdiff_saved_bytes, 0)) : '—'
					}
				/>
			</div>
			<FleetCard fleet={fleet} />
			<div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'>
				<HistoryCard history={history} />
				<ServiceCard />
			</div>
		</AppShell>
	)
}

function Attention({
	fleet,
	patches,
}: {
	fleet: FleetRow[]
	patches: { failed: number; pending: number }
}) {
	const items: { text: string; href?: string }[] = []
	const flagged = new Set<string>()

	// Only releases that devices still run are worth interrupting for.
	for (const row of fleet) {
		if (
			row.head_mode === 'ota' &&
			row.head_group_id &&
			row.active_users > 0 &&
			!flagged.has(row.head_group_id) &&
			crashTone(row.head_crashes, row.head_launches) === 'bad'
		) {
			flagged.add(row.head_group_id)

			items.push({
				text: `The live update for ${row.app_version || row.runtime_version} on ${row.channel} has a ${percent(ratio(row.head_crashes, row.head_launches))} known crash rate.`,
				href: `/releases/detail.html?id=${row.head_group_id}`,
			})
		}
	}

	if (patches.failed > 0)
		items.push({
			text: `${number(patches.failed)} bsdiff ${patches.failed === 1 ? 'patch' : 'patches'} failed to generate; affected devices download the full bundle instead.`,
		})

	if (items.length === 0) return null

	const shown = items.slice(0, 3)

	return (
		<div className='mb-6 space-y-2'>
			{shown.map((item) => (
				<div
					className='flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 text-sm'
					key={item.text}
				>
					<AlertTriangle className='mt-0.5 size-4 shrink-0 text-warning' />
					<p className='min-w-0 flex-1'>{item.text}</p>
					{item.href && (
						<a
							className='shrink-0 font-medium text-brand hover:underline'
							href={item.href}
						>
							View
						</a>
					)}
				</div>
			))}
			{items.length > shown.length && (
				<p className='px-1 text-xs text-muted-foreground'>
					And {items.length - shown.length} more.
				</p>
			)}
		</div>
	)
}

function FleetCard({ fleet }: { fleet: FleetRow[] }) {
	const channels = useMemo(() => {
		const totals = new Map<string, number>()

		for (const row of fleet)
			totals.set(row.channel, (totals.get(row.channel) ?? 0) + row.active_users)

		return [...totals].sort((a, b) => b[1] - a[1]).map(([name]) => name)
	}, [fleet])

	const [channel, setChannel] = useState(channels[0] ?? '')
	const [showInactive, setShowInactive] = useState(false)
	const rows = fleet.filter((row) => row.channel === channel)
	const active = rows.filter((row) => row.active_users > 0)
	const inactive = rows.filter((row) => row.active_users === 0)
	const visible = showInactive ? rows : active
	const total = active.reduce((sum, row) => sum + row.active_users, 0)

	return (
		<Card className='mt-6'>
			<CardHeader>
				<CardTitle>Live by native version</CardTitle>
				<CardDescription>
					Devices active in the last 7 days, grouped by the runtime they run,
					and how many of them already launched the live update.
				</CardDescription>
				{channels.length > 1 && (
					<CardAction>
						<Tabs
							onValueChange={setChannel}
							value={channel}
						>
							<TabsList>
								{channels.map((name) => (
									<TabsTrigger
										key={name}
										value={name}
									>
										{name}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</CardAction>
				)}
			</CardHeader>
			<CardContent className='px-0'>
				{visible.length === 0 ? (
					<div className='px-6'>
						<EmptyState
							title='No active devices'
							description='Devices appear here once they report activity on this channel.'
						/>
					</div>
				) : (
					<div className='divide-y border-y'>
						<div className='hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)_5rem] gap-4 px-6 py-2 text-xs font-medium text-muted-foreground md:grid'>
							<span>Native version</span>
							<span>Live update</span>
							<span>Reached</span>
							<span className='text-right'>Crashes</span>
						</div>
						{visible.map((row) => (
							<FleetRowView
								key={`${row.runtime_version}-${row.platform}`}
								row={row}
								total={total}
							/>
						))}
					</div>
				)}
				{inactive.length > 0 && (
					<div className='px-6 pt-3'>
						<Button
							onClick={() => setShowInactive((value) => !value)}
							size='sm'
							variant='ghost'
						>
							<ChevronDown
								className={cn(
									'transition-transform',
									showInactive && 'rotate-180',
								)}
							/>
							{showInactive
								? 'Hide runtimes without devices'
								: `Show ${inactive.length} runtime${inactive.length === 1 ? '' : 's'} without devices`}
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function FleetRowView({ row, total }: { row: FleetRow; total: number }) {
	const reach = ratio(row.head_users, row.active_users)

	return (
		<div className='grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)_5rem] md:items-center md:gap-4'>
			<div className='min-w-0'>
				<div className='flex items-baseline gap-2'>
					<span className='font-semibold'>
						{row.app_version || row.runtime_version}
					</span>
					<PlatformLabel platform={row.platform} />
				</div>
				<p className='mt-0.5 text-xs text-muted-foreground tabular-nums'>
					{number(row.active_users)} devices
					{total > 0 &&
						row.active_users > 0 &&
						` · ${percent(row.active_users / total)}`}
				</p>
			</div>
			<div className='min-w-0'>
				{row.head_mode === 'ota' && row.head_group_id ? (
					<>
						<a
							className='block truncate font-medium hover:text-brand'
							href={`/releases/detail.html?id=${row.head_group_id}`}
							title={row.head_message}
						>
							{row.head_message || 'Untitled release'}
						</a>
						<div className='mt-0.5 flex items-center gap-2 text-xs text-muted-foreground'>
							{row.head_updated_at && (
								<span title={formatDate(row.head_updated_at)}>
									{relativeTime(row.head_updated_at)}
								</span>
							)}
							<CommitLink sha={row.head_commit_sha} />
						</div>
					</>
				) : (
					<p className='text-sm text-muted-foreground'>
						{row.head_mode === 'embedded'
							? 'Reverted to the embedded bundle'
							: 'Embedded bundle · no OTA update published'}
					</p>
				)}
			</div>
			<div className='min-w-0'>
				{row.head_mode === 'ota' && row.active_users > 0 ? (
					<div className='flex items-center gap-3'>
						<div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
							<div
								className='h-full rounded-full bg-brand'
								style={{ width: `${Math.min(reach, 1) * 100}%` }}
							/>
						</div>
						<span className='w-12 text-right text-sm tabular-nums'>
							{percent(reach)}
						</span>
					</div>
				) : (
					<span className='text-sm text-muted-foreground'>—</span>
				)}
			</div>
			<div className='text-sm md:text-right'>
				{row.head_mode === 'ota' ? (
					<CrashRate
						crashes={row.head_crashes}
						launches={row.head_launches}
					/>
				) : (
					<span className='text-muted-foreground'>—</span>
				)}
			</div>
		</div>
	)
}

function HistoryCard({ history }: { history: HistoryEntry[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent deployments</CardTitle>
				<CardDescription>
					Every change to what a channel serves.
				</CardDescription>
				<CardAction>
					<a
						className='inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline'
						href='/channels/'
					>
						Channels
						<ArrowRight className='size-3.5' />
					</a>
				</CardAction>
			</CardHeader>
			<CardContent>
				{history.length === 0 ? (
					<EmptyState
						title='Nothing deployed yet'
						description='Publish an update with the hot-update CLI to get started.'
					/>
				) : (
					<HistoryList history={history} />
				)}
			</CardContent>
		</Card>
	)
}

function ServiceCard() {
	const query = useQuery({ queryKey: ['service'], queryFn: service })

	// The API reports per-minute buckets; hourly points keep the sparkline readable.
	const series = useMemo(() => {
		const raw = query.data?.series ?? []
		const hours = new Map<string, (typeof raw)[number]>()

		for (const point of raw) {
			const hour = `${point.minute.slice(0, 13)}:00:00Z`
			const bucket = hours.get(hour)

			if (bucket) {
				bucket.average_duration_ms =
					(bucket.average_duration_ms * bucket.requests +
						point.average_duration_ms * point.requests) /
					Math.max(bucket.requests + point.requests, 1)
				bucket.requests += point.requests
				bucket.errors += point.errors
			} else hours.set(hour, { ...point, minute: hour })
		}

		return [...hours.values()]
	}, [query.data])

	const requests = series.reduce((sum, point) => sum + point.requests, 0)
	const errors = series.reduce((sum, point) => sum + point.errors, 0)

	const latency =
		series.reduce(
			(sum, point) => sum + point.average_duration_ms * point.requests,
			0,
		) / Math.max(requests, 1)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Update server</CardTitle>
				<CardDescription>Request volume over the last 7 days.</CardDescription>
			</CardHeader>
			<CardContent>
				{query.isPending ? (
					<div className='h-40 animate-pulse rounded-lg bg-muted' />
				) : query.error ? (
					<ErrorState
						error={query.error}
						retry={() => void query.refetch()}
					/>
				) : (
					<>
						<dl className='mb-4 grid grid-cols-3 gap-3'>
							<Fact
								label='Requests'
								value={number(requests)}
							/>
							<Fact
								label='5xx rate'
								tone={ratio(errors, requests) > 0.01 ? 'bad' : undefined}
								value={percent(ratio(errors, requests))}
							/>
							<Fact
								label='Avg latency'
								value={`${Math.round(latency)} ms`}
							/>
						</dl>
						<ChartContainer
							className='h-28 w-full'
							config={serviceChart}
						>
							<AreaChart
								data={series}
								margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
							>
								<defs>
									<linearGradient
										id='service-fill'
										x1='0'
										x2='0'
										y1='0'
										y2='1'
									>
										<stop
											offset='0%'
											stopColor='var(--color-requests)'
											stopOpacity={0.3}
										/>
										<stop
											offset='100%'
											stopColor='var(--color-requests)'
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<XAxis
									dataKey='minute'
									hide
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											labelFormatter={(value) => formatDate(String(value))}
										/>
									}
								/>
								<Area
									dataKey='requests'
									fill='url(#service-fill)'
									stroke='var(--color-requests)'
									strokeWidth={1.5}
									type='monotone'
								/>
							</AreaChart>
						</ChartContainer>
					</>
				)}
			</CardContent>
		</Card>
	)
}

function Fact({
	label,
	value,
	tone,
}: {
	label: string
	value: string
	tone?: 'bad'
}) {
	return (
		<div>
			<dt className='text-xs text-muted-foreground'>{label}</dt>
			<dd
				className={cn(
					'mt-0.5 font-semibold tabular-nums',
					tone === 'bad' && 'text-destructive',
				)}
			>
				{value}
			</dd>
		</div>
	)
}
