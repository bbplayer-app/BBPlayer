import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from 'recharts'

import { audience, type Audience } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { changeBetween, Stat } from '@/components/stat'
import { Button } from '@/components/ui/button'
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	addDays,
	cn,
	dayLabel,
	longDayLabel,
	number,
	percent,
	queryParam,
} from '@/lib/utils'

const ranges = [
	{ days: 7, label: '7D' },
	{ days: 28, label: '28D' },
	{ days: 90, label: '90D' },
	{ days: 365, label: '12M' },
]

const activityChart = {
	mau: { label: '30 days', color: 'var(--chart-1)' },
	wau: { label: '7 days', color: 'var(--chart-2)' },
	dau: { label: '1 day', color: 'var(--chart-4)' },
} satisfies ChartConfig

const newUsersChart = {
	new_users: { label: 'New', color: 'var(--chart-1)' },
	returning: { label: 'Returning', color: 'var(--chart-5)' },
} satisfies ChartConfig

function initialDays() {
	const value = Number(queryParam('days'))

	return ranges.some((range) => range.days === value) ? value : 28
}

function syncURL(days: number, channel: string) {
	const params = new URLSearchParams({ days: String(days) })

	if (channel) params.set('channel', channel)
	window.history.replaceState(null, '', `?${params}`)
}

export function AudiencePage() {
	const [days, setDays] = useState(initialDays)
	const [channel, setChannel] = useState(() => queryParam('channel'))

	const query = useQuery({
		queryKey: ['audience', days, channel],
		queryFn: () => audience(days, channel),
		placeholderData: keepPreviousData,
	})

	const update = (nextDays: number, nextChannel: string) => {
		setDays(nextDays)
		setChannel(nextChannel)
		syncURL(nextDays, nextChannel)
	}

	const controls = (
		<div className='flex flex-wrap items-center gap-2'>
			<ChannelPicker
				channels={query.data?.channels ?? []}
				onChange={(next) => update(days, next)}
				value={channel}
			/>
			<Tabs
				onValueChange={(value) => update(Number(value), channel)}
				value={String(days)}
			>
				<TabsList>
					{ranges.map((range) => (
						<TabsTrigger
							key={range.days}
							value={String(range.days)}
						>
							{range.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	)

	return (
		<AppShell active='audience'>
			<PageHeader
				title='Audience'
				description='Active installations reported by the app. Days are UTC; the range ends with the last complete day.'
				action={controls}
			/>
			{query.isPending ? (
				<PageSkeleton />
			) : query.error ? (
				<ErrorState
					error={query.error}
					retry={() => void query.refetch()}
				/>
			) : (
				<div
					className={cn(
						'space-y-6 transition-opacity',
						query.isPlaceholderData && 'opacity-60',
					)}
				>
					<AudienceContent
						data={query.data}
						days={days}
					/>
				</div>
			)}
		</AppShell>
	)
}

function ChannelPicker({
	channels,
	value,
	onChange,
}: {
	channels: Audience['channels']
	value: string
	onChange: (channel: string) => void
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size='sm'
					variant='outline'
				>
					{value || 'All channels'}
					<ChevronDown />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuRadioGroup
					onValueChange={onChange}
					value={value}
				>
					<DropdownMenuRadioItem value=''>All channels</DropdownMenuRadioItem>
					{channels.map((item) => (
						<DropdownMenuRadioItem
							key={item.channel}
							value={item.channel}
						>
							<span className='flex-1'>{item.channel}</span>
							<span className='ml-4 text-xs text-muted-foreground tabular-nums'>
								{number(item.users)}
							</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function AudienceContent({ data, days }: { data: Audience; days: number }) {
	if (data.series.every((point) => point.mau === 0))
		return (
			<EmptyState
				title='No activity in this range'
				description='Active installations appear after the app reports launches to the update server.'
			/>
		)

	const { current, previous } = data
	// Before telemetry started every installation looks new and inactive,
	// so a comparison against that period would be meaningless.
	const comparable = data.previous_start >= data.data_start
	const latest = data.series.at(-1)!

	// Days before telemetry started have no data and would drag averages down.
	const observed = data.series.filter((point) => point.day >= data.data_start)
	const observedDays = Math.max(observed.length, 1)

	const stickiness =
		observed.reduce(
			(sum, point) => sum + (point.mau ? point.dau / point.mau : 0),
			0,
		) / observedDays

	const rangeLabel = `${longDayLabel(data.start)} – ${longDayLabel(addDays(data.end, -1))}`

	return (
		<>
			<div className='flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'>
				<span className='inline-flex items-center gap-2'>
					<CalendarDays className='size-4' />
					{rangeLabel}
					{comparable && ` · compared with the previous ${days} days`}
				</span>
				<span className='tabular-nums'>
					Today so far: {number(data.today.active_users)} active ·{' '}
					{number(data.today.new_users)} new
				</span>
			</div>
			<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
				<Stat
					change={
						comparable
							? changeBetween(current.active_users, previous.active_users)
							: undefined
					}
					hint='Distinct devices in range'
					label='Active users'
					value={number(current.active_users)}
				/>
				<Stat
					change={
						comparable
							? changeBetween(current.new_users, previous.new_users)
							: undefined
					}
					hint='First seen in range'
					label='New users'
					value={number(current.new_users)}
				/>
				<Stat
					change={
						comparable
							? changeBetween(
									current.active_user_days / observedDays,
									previous.active_user_days / days,
								)
							: undefined
					}
					hint={`Stickiness (DAU / MAU): ${percent(stickiness)}`}
					label='Avg. daily active users'
					value={number(Math.round(current.active_user_days / observedDays))}
				/>
				<Stat
					change={
						comparable && previous.active_users && current.active_users
							? changeBetween(
									current.active_user_days / current.active_users,
									previous.active_user_days / previous.active_users,
								)
							: undefined
					}
					hint={`Out of ${observedDays} days with data`}
					label='Active days per user'
					value={(current.active_users
						? current.active_user_days / current.active_users
						: 0
					).toFixed(2)}
				/>
			</div>
			<ActivityCard
				data={data}
				latest={latest}
			/>
			<div className='grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
				<NewUsersCard data={data} />
				<VersionsCard
					activeUsers={current.active_users}
					versions={data.versions}
				/>
			</div>
			<RetentionCard data={data} />
		</>
	)
}

function ActivityCard({
	data,
	latest,
}: {
	data: Audience
	latest: Audience['series'][number]
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>User activity over time</CardTitle>
				<CardDescription>
					Distinct installations active in the trailing 30, 7 and 1 day(s)
					ending on each day.
				</CardDescription>
			</CardHeader>
			<CardContent className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_11rem]'>
				<ChartContainer
					className='h-72 w-full'
					config={activityChart}
				>
					<LineChart
						accessibilityLayer
						data={data.series}
						margin={{ left: 4, right: 8 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							axisLine={false}
							dataKey='day'
							minTickGap={36}
							tickFormatter={dayLabel}
							tickLine={false}
						/>
						<YAxis
							axisLine={false}
							tickFormatter={(value: number) => number(value)}
							tickLine={false}
							width={48}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(value) => longDayLabel(String(value))}
								/>
							}
						/>
						{(['mau', 'wau', 'dau'] as const).map((key) => (
							<Line
								dataKey={key}
								dot={false}
								key={key}
								stroke={`var(--color-${key})`}
								strokeWidth={2}
								type='monotone'
							/>
						))}
					</LineChart>
				</ChartContainer>
				<dl className='grid grid-cols-3 gap-4 lg:grid-cols-1 lg:content-start lg:border-l lg:pl-6'>
					{(['mau', 'wau', 'dau'] as const).map((key) => (
						<div key={key}>
							<dt className='flex items-center gap-2 text-xs text-muted-foreground'>
								<span
									className='size-2.5 rounded-full'
									style={{ background: activityChart[key].color }}
								/>
								{activityChart[key].label.toUpperCase()}
							</dt>
							<dd className='mt-1 text-xl font-semibold tabular-nums sm:text-2xl'>
								{number(latest[key])}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	)
}

function NewUsersCard({ data }: { data: Audience }) {
	const series = data.series.map((point) => ({
		day: point.day,
		new_users: point.new_users,
		returning: Math.max(point.dau - point.new_users, 0),
	}))

	return (
		<Card>
			<CardHeader>
				<CardTitle>New vs returning users</CardTitle>
				<CardDescription>
					Daily active installations, split by whether they were first seen that
					day.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					className='h-64 w-full'
					config={newUsersChart}
				>
					<BarChart
						accessibilityLayer
						data={series}
						margin={{ left: 4, right: 8 }}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							axisLine={false}
							dataKey='day'
							minTickGap={36}
							tickFormatter={dayLabel}
							tickLine={false}
						/>
						<YAxis
							axisLine={false}
							tickFormatter={(value: number) => number(value)}
							tickLine={false}
							width={48}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(value) => longDayLabel(String(value))}
								/>
							}
						/>
						<Bar
							dataKey='returning'
							fill='var(--color-returning)'
							stackId='users'
						/>
						<Bar
							dataKey='new_users'
							fill='var(--color-new_users)'
							radius={[3, 3, 0, 0]}
							stackId='users'
						/>
						<ChartLegend content={<ChartLegendContent />} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}

function VersionsCard({
	versions,
	activeUsers,
}: {
	versions: Audience['versions']
	activeUsers: number
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Users by app version</CardTitle>
				<CardDescription>
					Native app version; an installation that upgraded counts under each
					version it ran.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Version</TableHead>
							<TableHead className='text-right'>Users</TableHead>
							<TableHead className='hidden text-right sm:table-cell'>
								On OTA
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{versions.map((version) => {
							const share = activeUsers ? version.users / activeUsers : 0

							return (
								<TableRow key={version.client_version}>
									<TableCell className='w-1/2'>
										<div className='font-mono text-xs'>
											{version.client_version}
										</div>
										<div className='mt-1.5 h-1.5 rounded-full bg-muted'>
											<div
												className='h-full rounded-full bg-brand'
												style={{ width: `${Math.min(share, 1) * 100}%` }}
											/>
										</div>
									</TableCell>
									<TableCell className='text-right tabular-nums'>
										{number(version.users)}
										<span className='ml-2 text-xs text-muted-foreground'>
											{percent(share)}
										</span>
									</TableCell>
									<TableCell className='hidden text-right text-muted-foreground tabular-nums sm:table-cell'>
										{version.users
											? percent(version.ota_users / version.users)
											: '—'}
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}

function RetentionCard({ data }: { data: Audience }) {
	const lastDay = addDays(data.end, -1)
	const columns = Math.max(0, ...data.retention.map((row) => row.weeks.length))

	return (
		<Card>
			<CardHeader>
				<CardTitle>Weekly cohort retention</CardTitle>
				<CardDescription>
					Installations grouped by the week they were first seen (weeks start
					Monday), and the share still active in each following week. Lighter
					cells are weeks still in progress.
					{(data.retention[0]?.cohort ?? data.data_start) < data.data_start &&
						` Cohorts before ${longDayLabel(data.data_start)} include installations seen before telemetry started.`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{data.retention.length === 0 ? (
					<EmptyState
						title='No cohorts yet'
						description='Cohorts appear once new installations are seen.'
					/>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full min-w-[40rem] border-separate border-spacing-1 text-sm'>
							<thead>
								<tr className='text-xs text-muted-foreground'>
									<th className='w-24 px-2 py-1 text-left font-medium'>
										Cohort
									</th>
									<th className='w-20 px-2 py-1 text-right font-medium'>
										Users
									</th>
									{Array.from({ length: Math.max(columns - 1, 0) }, (_, i) => (
										<th
											className='px-2 py-1 text-center font-medium'
											key={i}
										>
											Week {i + 1}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{data.retention.map((row) => (
									<tr key={row.cohort}>
										<td className='px-2 py-1.5 whitespace-nowrap'>
											{dayLabel(row.cohort)}
										</td>
										<td className='px-2 py-1.5 text-right tabular-nums'>
											{number(row.weeks[0] ?? 0)}
										</td>
										{Array.from(
											{ length: Math.max(columns - 1, 0) },
											(_, i) => {
												const offset = i + 1
												const users = row.weeks[offset]

												if (users === undefined) {
													return <td key={offset} />
												}

												const rate = row.weeks[0] ? users / row.weeks[0] : 0

												const partial =
													addDays(row.cohort, offset * 7 + 6) > lastDay

												return (
													<td
														className={cn(
															'rounded-md px-2 py-1.5 text-center tabular-nums',
															rate > 0.35 && 'text-brand-foreground',
															partial && 'opacity-50',
														)}
														key={offset}
														style={{
															background: `color-mix(in oklch, var(--brand) ${Math.min(100, Math.round(rate * 160))}%, transparent)`,
														}}
														title={`${number(users)} of ${number(row.weeks[0])} users`}
													>
														{percent(rate)}
													</td>
												)
											},
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
