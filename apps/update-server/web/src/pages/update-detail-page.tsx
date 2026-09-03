import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { assets, detail, lifecycle, type Detail } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	bytes,
	chartDate,
	formatDate,
	number,
	percent,
	queryParam,
	shortID,
	sourceCommit,
} from '@/lib/utils'

const lifecycleConfig = {
	known_launches: { label: 'Known launches', color: 'var(--chart-2)' },
	known_crashes: { label: 'Known crashes', color: 'var(--destructive)' },
} satisfies ChartConfig

export function UpdateDetailPage() {
	const id = queryParam('id')
	const detailQuery = useQuery({
		queryKey: ['update', id],
		queryFn: () => detail(id),
		enabled: Boolean(id),
	})
	const lifecycleQuery = useQuery({
		queryKey: ['lifecycle', id],
		queryFn: () => lifecycle(id),
		enabled: Boolean(id),
	})
	if (!id)
		return (
			<AppShell active='updates'>
				<ErrorState error={new Error('No update group ID was provided.')} />
			</AppShell>
		)
	if (detailQuery.isPending)
		return (
			<AppShell active='updates'>
				<PageSkeleton />
			</AppShell>
		)
	if (detailQuery.error)
		return (
			<AppShell active='updates'>
				<ErrorState
					error={detailQuery.error}
					retry={() => void detailQuery.refetch()}
				/>
			</AppShell>
		)
	const update = detailQuery.data
	return (
		<AppShell active='updates'>
			<PageHeader
				title={update.message || 'Update group'}
				parent={{ label: 'Update groups', href: '/updates/' }}
				description={`Published ${formatDate(update.created_at)}`}
			/>
			<Card>
				<CardHeader>
					<CardTitle>Update group</CardTitle>
					<CardDescription>
						Shared metadata for every platform in this release.
					</CardDescription>
				</CardHeader>
				<CardContent className='grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4'>
					<Info
						label='Group ID'
						value={shortID(update.id)}
						mono
					/>
					<Info
						label='Channel'
						value={update.channel || 'Unlinked'}
					/>
					<Info
						label='App version'
						value={update.app_version || '—'}
					/>
					<Info
						label='Runtime'
						value={update.runtime_version}
						mono
					/>
					<Info
						label='Commit'
						value={sourceCommit(update.source)}
						mono
					/>
					<Info
						label='Fingerprint'
						value={
							update.fingerprint_hash
								? shortID(update.fingerprint_hash)
								: 'Not recorded'
						}
						mono
					/>
				</CardContent>
			</Card>
			<section className='mt-8'>
				<h2 className='mb-3 text-lg font-semibold'>
					Platform-specific updates
				</h2>
				{update.platforms.length === 0 ? (
					<EmptyState
						title='No platform updates'
						description='This group does not contain a platform release.'
					/>
				) : (
					<div className='overflow-hidden rounded-xl border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Platform</TableHead>
									<TableHead className='hidden sm:table-cell'>
										Update ID
									</TableHead>
									<TableHead>Bundle size</TableHead>
									<TableHead className='hidden lg:table-cell'>
										Downloads
									</TableHead>
									<TableHead className='hidden xl:table-cell'>
										Known health
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{update.platforms.map((item) => (
									<TableRow key={item.id}>
										<TableCell>
											<Badge
												variant='secondary'
												className='capitalize'
											>
												{item.platform}
											</Badge>
										</TableCell>
										<TableCell className='hidden font-mono text-xs sm:table-cell'>
											{shortID(item.id)}
										</TableCell>
										<TableCell>{bytes(item.launch_size)}</TableCell>
										<TableCell className='hidden tabular-nums lg:table-cell'>
											{number(item.downloads)}
										</TableCell>
										<TableCell className='hidden xl:table-cell'>
											{number(item.known_launches)} launches ·{' '}
											{percent(
												item.known_launches
													? item.known_crashes / item.known_launches
													: 0,
											)}{' '}
											crashes
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</section>
			<div className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.8fr)]'>
				<Card>
					<CardHeader>
						<CardTitle>Lifecycle</CardTitle>
						<CardDescription>
							Known launches and crashes reported by clients.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{lifecycleQuery.isPending ? (
							<div className='h-72 animate-pulse rounded-lg bg-muted' />
						) : lifecycleQuery.error ? (
							<ErrorState
								error={lifecycleQuery.error}
								retry={() => void lifecycleQuery.refetch()}
							/>
						) : lifecycleQuery.data.series.length === 0 ? (
							<EmptyState
								title='No lifecycle data'
								description='Telemetry will appear after clients launch this update.'
							/>
						) : (
							<ChartContainer
								className='h-72 w-full'
								config={lifecycleConfig}
							>
								<LineChart
									accessibilityLayer
									data={lifecycleQuery.data.series}
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
										dataKey='known_launches'
										dot={false}
										stroke='var(--color-known_launches)'
										strokeWidth={2}
										type='monotone'
									/>
									<Line
										dataKey='known_crashes'
										dot={false}
										stroke='var(--color-known_crashes)'
										strokeWidth={2}
										type='monotone'
									/>
								</LineChart>
							</ChartContainer>
						)}
					</CardContent>
				</Card>
				<AssetPanel
					id={id}
					platforms={update.platforms}
				/>
			</div>
		</AppShell>
	)
}

function Info({
	label,
	value,
	mono = false,
}: {
	label: string
	value: string
	mono?: boolean
}) {
	return (
		<div>
			<p className='text-xs font-medium text-muted-foreground'>{label}</p>
			<p className={`mt-1 break-all text-sm ${mono ? 'font-mono' : ''}`}>
				{value}
			</p>
		</div>
	)
}

function AssetPanel({
	id,
	platforms,
}: {
	id: string
	platforms: Detail['platforms']
}) {
	if (platforms.length === 0)
		return (
			<Card>
				<CardHeader>
					<CardTitle>Assets</CardTitle>
					<CardDescription>No platform assets are available.</CardDescription>
				</CardHeader>
			</Card>
		)
	return (
		<Card>
			<CardHeader>
				<CardTitle>Assets</CardTitle>
				<CardDescription>
					Bundles and immutable files delivered for this update.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue={platforms[0].platform}>
					<TabsList>
						{platforms.map((item) => (
							<TabsTrigger
								className='capitalize'
								key={item.platform}
								value={item.platform}
							>
								{item.platform}
							</TabsTrigger>
						))}
					</TabsList>
					{platforms.map((item) => (
						<TabsContent
							key={item.platform}
							value={item.platform}
						>
							<Assets
								id={id}
								platform={item.platform}
							/>
						</TabsContent>
					))}
				</Tabs>
			</CardContent>
		</Card>
	)
}

function Assets({ id, platform }: { id: string; platform: string }) {
	const query = useQuery({
		queryKey: ['assets', id, platform],
		queryFn: () => assets(id, platform),
	})
	if (query.isPending)
		return <div className='mt-4 h-32 animate-pulse rounded-lg bg-muted' />
	if (query.error)
		return (
			<ErrorState
				error={query.error}
				retry={() => void query.refetch()}
			/>
		)
	if (query.data.length === 0)
		return (
			<EmptyState
				title='No assets'
				description='No stored assets were returned for this platform.'
			/>
		)
	return (
		<div className='mt-4 max-h-64 overflow-auto rounded-lg border'>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Asset</TableHead>
						<TableHead>Size</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{query.data.map((asset) => (
						<TableRow key={asset.id}>
							<TableCell className='max-w-48'>
								<p
									className='truncate font-mono text-xs'
									title={asset.asset_key}
								>
									{asset.asset_key}
								</p>
								{asset.is_launch && (
									<Badge
										className='mt-1'
										variant='outline'
									>
										Launch
									</Badge>
								)}
							</TableCell>
							<TableCell>{bytes(asset.size_bytes)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
