import { useQuery } from '@tanstack/react-query'
import {
	ChevronDown,
	GitCompare,
	Repeat,
	RotateCcwIcon,
	Undo2Icon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
} from 'recharts'

import {
	adoption,
	assets,
	lifecycle,
	release,
	type Platform,
	type ReleaseDetail,
	type ReleasePlatform,
} from '@/api'
import { AppShell } from '@/components/app-shell'
import {
	CrashRate,
	LiveBadge,
	PatchStatusBadge,
	PlatformLabel,
} from '@/components/badges'
import { CommitLink } from '@/components/commit-link'
import { FingerprintMetadataDialog } from '@/components/fingerprint-metadata-dialog'
import { Identifier } from '@/components/identifier'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import {
	ReleaseActionDialog,
	type ReleaseAction,
} from '@/components/release-actions'
import { Stat } from '@/components/stat'
import { Badge } from '@/components/ui/badge'
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
	bytes,
	compareURL,
	dayLabel,
	formatDate,
	longDayLabel,
	number,
	percent,
	queryParam,
	ratio,
	relativeTime,
	sourceCommitSha,
} from '@/lib/utils'

const adoptionChart = {
	release_users: { label: 'On this release', color: 'var(--chart-1)' },
	other_users: { label: 'Other bundles', color: 'var(--chart-5)' },
} satisfies ChartConfig

const healthChart = {
	known_launches: { label: 'Launches', color: 'var(--chart-2)' },
	known_crashes: { label: 'Crashes', color: 'var(--destructive)' },
} satisfies ChartConfig

// Days of history the charts cover, from publication up to this cap.
const maxChartDays = 90

export function ReleaseDetailPage() {
	const id = queryParam('id')

	const query = useQuery({
		queryKey: ['release', id],
		queryFn: () => release(id),
		enabled: Boolean(id),
	})

	if (!id)
		return (
			<AppShell active='releases'>
				<ErrorState error={new Error('No release ID was provided.')} />
			</AppShell>
		)

	if (query.isPending)
		return (
			<AppShell active='releases'>
				<PageSkeleton />
			</AppShell>
		)

	if (query.error)
		return (
			<AppShell active='releases'>
				<ErrorState
					error={query.error}
					retry={() => void query.refetch()}
				/>
			</AppShell>
		)

	return (
		<AppShell active='releases'>
			<ReleaseView detail={query.data} />
		</AppShell>
	)
}

function ReleaseView({ detail }: { detail: ReleaseDetail }) {
	const [action, setAction] = useState<ReleaseAction | null>(null)
	const live = detail.platforms.some((item) => item.is_live)
	const commit = sourceCommitSha(detail.source)

	// Captured once so re-renders don't shift the chart range.
	const [now] = useState(() => Date.now())

	const chartDays = Math.min(
		maxChartDays,
		Math.max(
			7,
			Math.ceil((now - new Date(detail.created_at).getTime()) / 86_400_000) + 1,
		),
	)

	const adoptionQuery = useQuery({
		queryKey: ['adoption', detail.id, chartDays],
		queryFn: () => adoption(detail.id, chartDays),
	})

	const launches = detail.platforms.reduce(
		(sum, item) => sum + item.known_launches,
		0,
	)

	const crashes = detail.platforms.reduce(
		(sum, item) => sum + item.known_crashes,
		0,
	)

	const full = detail.platforms.reduce(
		(sum, item) => sum + item.full_downloads,
		0,
	)

	const patched = detail.platforms.reduce(
		(sum, item) => sum + item.patch_downloads,
		0,
	)

	const saved = detail.platforms.reduce(
		(sum, item) =>
			sum + Math.max(item.patch_target_bytes - item.patch_bytes, 0),
		0,
	)

	const latest = adoptionQuery.data?.reduce<
		{ day: string; release_users: number; runtime_users: number } | undefined
	>((last, point) => (point.runtime_users > 0 ? point : last), undefined)

	const ref = {
		id: detail.id,
		channel: detail.channel,
		runtime_version: detail.runtime_version,
		message: detail.message,
		created_at: detail.created_at,
		platforms: detail.platforms.map((item) => item.platform),
	}

	return (
		<>
			<PageHeader
				title={detail.message || 'Untitled release'}
				parent={{ label: 'Releases', href: '/releases/' }}
				action={
					<div className='flex flex-wrap gap-2'>
						{!live && (
							<Button
								onClick={() => setAction('republish')}
								size='sm'
								variant='outline'
							>
								<RotateCcwIcon />
								Republish
							</Button>
						)}
						{live && (
							<Button
								onClick={() => setAction('embedded')}
								size='sm'
								variant='outline'
							>
								<Undo2Icon />
								Revert to embedded
							</Button>
						)}
					</div>
				}
			/>
			<div className='-mt-4 mb-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground'>
				{live ? <LiveBadge /> : <Badge variant='secondary'>Not live</Badge>}
				<span>
					<span className='font-medium text-foreground'>
						{detail.app_version || detail.runtime_version}
					</span>{' '}
					on {detail.channel}
				</span>
				<span title={formatDate(detail.created_at)}>
					Published {relativeTime(detail.created_at)}
				</span>
				<CommitLink sha={commit} />
			</div>
			{action && (
				<ReleaseActionDialog
					action={action}
					candidates={[ref]}
					onOpenChange={(open) => !open && setAction(null)}
					open
				/>
			)}
			<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
				<Stat
					hint={
						latest
							? `${number(latest.release_users)} of ${number(latest.runtime_users)} devices on ${longDayLabel(latest.day)}`
							: 'Share of devices on this runtime'
					}
					label='Adoption'
					value={
						latest
							? percent(ratio(latest.release_users, latest.runtime_users))
							: '—'
					}
				/>
				<Stat
					hint='Devices that launched it at least once'
					label='Known launches'
					value={number(launches)}
				/>
				<Stat
					hint={`${number(crashes)} devices fell back after a crash`}
					label='Crash rate'
					value={
						<CrashRate
							crashes={crashes}
							launches={launches}
						/>
					}
				/>
				<Stat
					hint={
						patched > 0
							? `${number(patched)} as patches · ${bytes(saved)} saved`
							: 'Full bundles and bsdiff patches'
					}
					label='Downloads'
					value={number(full + patched)}
				/>
			</div>
			<div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'>
				<div className='min-w-0 space-y-6'>
					<AdoptionCard
						data={adoptionQuery.data}
						error={adoptionQuery.error}
						pending={adoptionQuery.isPending}
						retry={() => void adoptionQuery.refetch()}
					/>
					<HealthCard
						createdAt={detail.created_at}
						days={chartDays}
						id={detail.id}
					/>
					<DeliveryCard
						id={detail.id}
						platforms={detail.platforms}
					/>
				</div>
				<DetailsCard
					commit={commit}
					detail={detail}
				/>
			</div>
		</>
	)
}

function AdoptionCard({
	data,
	pending,
	error,
	retry,
}: {
	data:
		| { day: string; release_users: number; runtime_users: number }[]
		| undefined
	pending: boolean
	error: Error | null
	retry: () => void
}) {
	const series = data?.map((point) => ({
		day: point.day,
		release_users: point.release_users,
		other_users: Math.max(point.runtime_users - point.release_users, 0),
	}))

	return (
		<Card>
			<CardHeader>
				<CardTitle>Rollout</CardTitle>
				<CardDescription>
					Daily active devices on this runtime and channel, split by whether
					they launched this release.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{pending ? (
					<div className='h-64 animate-pulse rounded-lg bg-muted' />
				) : error ? (
					<ErrorState
						error={error}
						retry={retry}
					/>
				) : !series?.length ? (
					<EmptyState
						title='No device activity yet'
						description='Devices appear once they report activity on this runtime.'
					/>
				) : (
					<ChartContainer
						className='h-64 w-full'
						config={adoptionChart}
					>
						<AreaChart
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
								width={44}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(value) => longDayLabel(String(value))}
									/>
								}
							/>
							<Area
								dataKey='release_users'
								fill='var(--color-release_users)'
								fillOpacity={0.35}
								stackId='devices'
								stroke='var(--color-release_users)'
								strokeWidth={2}
								type='monotone'
							/>
							<Area
								dataKey='other_users'
								fill='var(--color-other_users)'
								fillOpacity={0.3}
								stackId='devices'
								stroke='var(--color-other_users)'
								strokeWidth={1}
								type='monotone'
							/>
							<ChartLegend content={<ChartLegendContent />} />
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	)
}

function HealthCard({
	id,
	createdAt,
	days,
}: {
	id: string
	createdAt: string
	days: number
}) {
	const [now] = useState(() => Date.now())

	const start = new Date(
		Math.max(new Date(createdAt).getTime(), now - (days - 1) * 86_400_000),
	).toISOString()

	const query = useQuery({
		queryKey: ['lifecycle', id, start.slice(0, 10)],
		queryFn: () => lifecycle(id, start),
	})

	return (
		<Card>
			<CardHeader>
				<CardTitle>Launch health</CardTitle>
				<CardDescription>
					Devices launching this release for the first time, and devices that
					crashed and fell back to an earlier bundle.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{query.isPending ? (
					<div className='h-56 animate-pulse rounded-lg bg-muted' />
				) : query.error ? (
					<ErrorState
						error={query.error}
						retry={() => void query.refetch()}
					/>
				) : query.data.series.length === 0 ? (
					<EmptyState
						title='No launches in this period'
						description='Launches appear after devices download and start this release.'
					/>
				) : (
					<ChartContainer
						className='h-56 w-full'
						config={healthChart}
					>
						<BarChart
							accessibilityLayer
							data={query.data.series}
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
								width={44}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(value) => longDayLabel(String(value))}
									/>
								}
							/>
							<Bar
								dataKey='known_launches'
								fill='var(--color-known_launches)'
								radius={[3, 3, 0, 0]}
							/>
							<Bar
								dataKey='known_crashes'
								fill='var(--color-known_crashes)'
								radius={[3, 3, 0, 0]}
							/>
							<ChartLegend content={<ChartLegendContent />} />
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	)
}

function DeliveryCard({
	id,
	platforms,
}: {
	id: string
	platforms: ReleasePlatform[]
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Delivery</CardTitle>
				<CardDescription>
					The launch bundle and the bsdiff patches generated from earlier
					releases. Devices on a patched base download only the difference.
				</CardDescription>
			</CardHeader>
			<CardContent className='space-y-6'>
				{platforms.length === 0 ? (
					<EmptyState
						title='No platform bundles'
						description='This release contains no platform updates.'
					/>
				) : (
					platforms.map((item) => (
						<PlatformDelivery
							id={id}
							item={item}
							key={item.id}
							showPlatform={platforms.length > 1}
						/>
					))
				)}
			</CardContent>
		</Card>
	)
}

function PlatformDelivery({
	id,
	item,
	showPlatform,
}: {
	id: string
	item: ReleasePlatform
	showPlatform: boolean
}) {
	return (
		<div className='space-y-3'>
			{showPlatform && <PlatformLabel platform={item.platform} />}
			<div className='divide-y rounded-lg border'>
				<div className='flex items-center justify-between gap-4 px-4 py-3'>
					<div className='min-w-0'>
						<p className='text-sm font-medium'>Full bundle</p>
						<p className='text-xs text-muted-foreground'>
							{number(item.full_downloads)} downloads
						</p>
					</div>
					<span className='text-sm tabular-nums'>
						{bytes(item.launch_size)}
					</span>
				</div>
				{item.patches.map((patch) => (
					<div
						className='flex items-center justify-between gap-4 px-4 py-3'
						key={patch.id}
					>
						<div className='min-w-0'>
							<p className='truncate text-sm'>
								Patch from{' '}
								<a
									className='font-medium hover:text-brand'
									href={`/releases/detail.html?id=${patch.from_group_id}`}
								>
									{patch.from_message || 'an earlier release'}
								</a>
							</p>
							<p className='truncate text-xs text-muted-foreground'>
								{patch.error
									? patch.error
									: patch.status === 'ready'
										? `${number(patch.served_count)} downloads${patch.size_bytes !== undefined ? ` · ${percent(Math.max(0, 1 - patch.size_bytes / item.launch_size))} smaller` : ''}`
										: patch.status === 'processing'
											? `Attempt ${patch.attempts}`
											: patch.status === 'not_beneficial'
												? 'The patch would not be smaller than the full bundle'
												: 'Waiting for the patch worker'}
							</p>
						</div>
						<div className='flex shrink-0 items-center gap-3'>
							{patch.size_bytes !== undefined && (
								<span className='text-sm tabular-nums'>
									{bytes(patch.size_bytes)}
								</span>
							)}
							<PatchStatusBadge status={patch.status} />
						</div>
					</div>
				))}
			</div>
			<AssetList
				id={id}
				platform={item.platform}
			/>
		</div>
	)
}

function AssetList({ id, platform }: { id: string; platform: Platform }) {
	const [open, setOpen] = useState(false)

	const query = useQuery({
		queryKey: ['assets', id, platform],
		queryFn: () => assets(id, platform),
		enabled: open,
	})

	const files = query.data?.filter((asset) => !asset.is_launch) ?? []

	return (
		<div>
			<Button
				onClick={() => setOpen((value) => !value)}
				size='sm'
				variant='ghost'
			>
				<ChevronDown
					className={
						open ? 'rotate-180 transition-transform' : 'transition-transform'
					}
				/>
				{open ? 'Hide static assets' : 'Show static assets'}
			</Button>
			{open &&
				(query.isPending ? (
					<div className='mt-2 h-24 animate-pulse rounded-lg bg-muted' />
				) : query.error ? (
					<ErrorState
						error={query.error}
						retry={() => void query.refetch()}
					/>
				) : files.length === 0 ? (
					<p className='mt-2 px-3 text-sm text-muted-foreground'>
						This release only contains its launch bundle.
					</p>
				) : (
					<ul className='mt-2 max-h-64 divide-y overflow-y-auto rounded-lg border text-sm'>
						{files.map((asset) => (
							<li
								className='flex items-center justify-between gap-4 px-3 py-2'
								key={asset.id}
							>
								<span
									className='truncate font-mono text-xs'
									title={asset.asset_key}
								>
									{asset.asset_key}
								</span>
								<span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
									{bytes(asset.size_bytes)}
								</span>
							</li>
						))}
					</ul>
				))}
		</div>
	)
}

function DetailsCard({
	detail,
	commit,
}: {
	detail: ReleaseDetail
	commit: string
}) {
	const previous = detail.previous
	const compare = previous ? compareURL(previous.commit_sha, commit) : ''

	return (
		<Card className='h-fit'>
			<CardHeader>
				<CardTitle>Details</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className='space-y-4 text-sm'>
					<Field label='Release ID'>
						<Identifier
							label='release ID'
							value={detail.id}
						/>
					</Field>
					{detail.platforms.map((item) => (
						<Field
							key={item.id}
							label={`${item.platform === 'ios' ? 'iOS' : 'Android'} update ID`}
						>
							<Identifier
								label='update ID'
								value={item.id}
							/>
						</Field>
					))}
					<Field label='Runtime version'>
						<span
							className='font-mono text-xs break-all'
							title={detail.runtime_version}
						>
							{detail.runtime_version}
						</span>
					</Field>
					<Field label='Channel'>{detail.channel}</Field>
					<Field label='Published'>{formatDate(detail.created_at)}</Field>
					<Field label='Commit'>
						<CommitLink sha={commit} />
					</Field>
					{previous && (
						<Field label='Previous release'>
							<a
								className='block truncate hover:text-brand'
								href={`/releases/detail.html?id=${previous.id}`}
								title={previous.message}
							>
								{previous.message || 'Untitled release'}
							</a>
							{compare && (
								<a
									className='mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline'
									href={compare}
									rel='noreferrer'
									target='_blank'
								>
									<GitCompare className='size-3.5' />
									Compare changes
								</a>
							)}
						</Field>
					)}
					{detail.republished_from_group_id && (
						<Field label='Republished from'>
							<a
								className='inline-flex items-center gap-1.5 hover:text-brand'
								href={`/releases/detail.html?id=${detail.republished_from_group_id}`}
							>
								<Repeat className='size-3.5 text-muted-foreground' />
								Original release
							</a>
						</Field>
					)}
					{detail.fingerprint_hash && (
						<Field label='Fingerprint'>
							<div className='flex flex-wrap items-center gap-2'>
								<Identifier
									label='fingerprint'
									value={detail.fingerprint_hash}
								/>
								<FingerprintMetadataDialog
									hash={detail.fingerprint_hash}
									sources={detail.fingerprint_sources}
								/>
							</div>
						</Field>
					)}
				</dl>
			</CardContent>
		</Card>
	)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className='min-w-0'>
			<dt className='text-xs text-muted-foreground'>{label}</dt>
			<dd className='mt-0.5 min-w-0'>{children}</dd>
		</div>
	)
}
