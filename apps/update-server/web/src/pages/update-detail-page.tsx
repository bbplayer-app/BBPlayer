import {
	useQuery,
	useQueryClient,
	type QueryClient,
} from '@tanstack/react-query'
import { MoreHorizontalIcon, RotateCcwIcon, Undo2Icon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import {
	assets,
	detail,
	headGroupID,
	heads,
	lifecycle,
	republishChannel,
	setChannelEmbedded,
	type Detail,
	type Head,
} from '@/api'
import { AppShell } from '@/components/app-shell'
import { FingerprintMetadataDialog } from '@/components/fingerprint-metadata-dialog'
import { Identifier } from '@/components/identifier'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
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
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@/components/ui/chart'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
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
	const channel = detailQuery.data?.channel
	const channelHeadsQuery = useQuery({
		queryKey: ['heads', channel],
		queryFn: () => heads(channel ?? ''),
		enabled: Boolean(channel),
	})
	const queryClient = useQueryClient()
	const [republishOpen, setRepublishOpen] = useState(false)
	const [embeddedOpen, setEmbeddedOpen] = useState(false)
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
				action={
					<DropdownMenu>
						<DropdownMenuTrigger
							aria-label='Update group actions'
							asChild
						>
							<Button
								variant='outline'
								size='icon-sm'
							>
								<MoreHorizontalIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem
								disabled={!update.channel || update.platforms.length === 0}
								variant='destructive'
								onSelect={() => setRepublishOpen(true)}
							>
								<RotateCcwIcon />
								{!update.channel
									? 'Republish (requires a channel)'
									: update.platforms.length === 0
										? 'Republish (no platform updates)'
										: 'Republish this update'}
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!update.channel || update.platforms.length === 0}
								variant='destructive'
								onSelect={() => setEmbeddedOpen(true)}
							>
								<Undo2Icon />
								{!update.channel
									? 'Revert to embedded bundle (requires a channel)'
									: update.platforms.length === 0
										? 'Revert to embedded bundle (no platform updates)'
										: 'Revert to embedded bundle'}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				}
			/>
			{update.channel && (
				<>
					<RepublishDialog
						headsQueryData={channelHeadsQuery.data}
						headsQueryPending={channelHeadsQuery.isPending}
						onOpenChange={setRepublishOpen}
						open={republishOpen}
						queryClient={queryClient}
						update={update}
					/>
					<EmbeddedDialog
						headsQueryData={channelHeadsQuery.data}
						headsQueryPending={channelHeadsQuery.isPending}
						onOpenChange={setEmbeddedOpen}
						open={embeddedOpen}
						queryClient={queryClient}
						update={update}
					/>
				</>
			)}
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
						value={
							<Identifier
								label='group ID'
								value={update.id}
							/>
						}
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
							update.fingerprint_hash ? (
								<div className='flex flex-wrap items-center gap-2'>
									<Identifier
										label='fingerprint'
										value={update.fingerprint_hash}
									/>
									<FingerprintMetadataDialog
										hash={update.fingerprint_hash}
										sources={update.fingerprint_sources}
									/>
								</div>
							) : (
								'Not recorded'
							)
						}
					/>
					{update.republished_from_update_id && (
						<Info
							label='Publication'
							value={
								<div className='flex flex-wrap items-center gap-2'>
									<Badge variant='secondary'>Republished</Badge>
									<a
										className='text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
										href={`/updates/detail.html?id=${encodeURIComponent(update.republished_from_update_id)}`}
									>
										View original update group
									</a>
								</div>
							}
						/>
					)}
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
									<TableHead>Channel head</TableHead>
									<TableHead className='hidden lg:table-cell'>
										Bundle size
									</TableHead>
									<TableHead className='hidden xl:table-cell'>
										Known health
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{update.platforms.map((item) => {
									const head = findHead(
										channelHeadsQuery.data,
										update.runtime_version,
										item.platform,
									)
									return (
										<TableRow key={item.id}>
											<TableCell>
												<Badge
													variant='secondary'
													className='capitalize'
												>
													{item.platform}
												</Badge>
											</TableCell>
											<TableCell className='hidden sm:table-cell'>
												<Identifier
													label='update ID'
													value={item.id}
												/>
											</TableCell>
											<TableCell>
												{channelHeadsQuery.isPending ? (
													<span className='text-xs text-muted-foreground'>
														Loading…
													</span>
												) : (
													<HeadLabel
														groupId={update.id}
														head={head}
													/>
												)}
											</TableCell>
											<TableCell className='hidden tabular-nums lg:table-cell'>
												{bytes(item.launch_size)}
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
									)
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</section>
			<section className='mt-8'>
				<h2 className='mb-3 text-lg font-semibold'>Downloads</h2>
				{update.platforms.length === 0 ? (
					<EmptyState
						title='No download data'
						description='This group does not contain a platform release.'
					/>
				) : (
					<Card>
						<CardHeader>
							<CardDescription>
								Full launch bundles and bsdiff patches served to clients,
								counted by the server. Delivery metrics are retained for 90
								days.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Platform</TableHead>
										<TableHead className='text-right'>Full bundles</TableHead>
										<TableHead className='text-right'>Patch (bsdiff)</TableHead>
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
											<TableCell className='text-right tabular-nums'>
												{number(item.full_downloads)}
											</TableCell>
											<TableCell className='text-right tabular-nums'>
												{number(item.patch_downloads)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
								<TableFooter>
									<TableRow>
										<TableCell>All platforms</TableCell>
										<TableCell className='text-right tabular-nums'>
											{number(
												update.platforms.reduce(
													(total, item) => total + item.full_downloads,
													0,
												),
											)}
										</TableCell>
										<TableCell className='text-right tabular-nums'>
											{number(
												update.platforms.reduce(
													(total, item) => total + item.patch_downloads,
													0,
												),
											)}
										</TableCell>
									</TableRow>
								</TableFooter>
							</Table>
						</CardContent>
					</Card>
				)}
			</section>
			<div className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.8fr)]'>
				<Card>
					<CardHeader>
						<CardTitle>Lifecycle</CardTitle>
						<CardDescription>
							Known launches and crashes reported by clients over the last seven
							days.
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

function findHead(
	headsData: Head[] | undefined,
	runtime: string,
	platform: string,
) {
	return headsData?.find(
		(item) => item.runtime_version === runtime && item.platform === platform,
	)
}

function HeadLabel({
	head,
	groupId,
}: {
	head: Head | undefined
	groupId: string
}) {
	if (!head)
		return <span className='text-xs text-muted-foreground'>No head</span>
	if (head.mode === 'embedded') return <StatusBadge value='embedded' />
	const current = headGroupID(head)
	if (current === groupId)
		return <Badge className='whitespace-nowrap'>Current head</Badge>
	if (!current)
		return <span className='text-xs text-muted-foreground'>No head</span>
	return (
		<Identifier
			label='current head group ID'
			value={current}
		/>
	)
}

type RepublishOutcome = { platform: string; ok: boolean; message?: string }

function RepublishDialog({
	update,
	headsQueryData,
	headsQueryPending,
	open,
	onOpenChange,
	queryClient,
}: {
	update: Detail
	headsQueryData: Head[] | undefined
	headsQueryPending: boolean
	open: boolean
	onOpenChange: (value: boolean) => void
	queryClient: QueryClient
}) {
	const channel = update.channel
	const [running, setRunning] = useState(false)
	const [message, setMessage] = useState(`Republish ${update.message}`)
	const [outcomes, setOutcomes] = useState<RepublishOutcome[] | null>(null)
	const rows = update.platforms.map((item) => ({
		platform: item.platform,
		head: findHead(headsQueryData, update.runtime_version, item.platform),
	}))
	const actionable = rows.filter(
		(row) => !(row.head?.mode === 'ota' && headGroupID(row.head) === update.id),
	)
	const pending = headsQueryPending || headsQueryData === undefined

	async function run() {
		if (!channel) return
		setRunning(true)
		setOutcomes([])
		const result: RepublishOutcome[] = []
		for (const row of actionable) {
			try {
				await republishChannel(channel, {
					runtime_version: update.runtime_version,
					platform: row.platform,
					group_id: update.id,
					message: message.trim(),
				})
				result.push({ platform: row.platform, ok: true })
			} catch (error) {
				result.push({
					platform: row.platform,
					ok: false,
					message: error instanceof Error ? error.message : 'Republish failed',
				})
			}
		}
		setOutcomes(result)
		setRunning(false)
		void queryClient.invalidateQueries({ queryKey: ['heads', channel] })
		void queryClient.invalidateQueries({ queryKey: ['channel', channel] })
	}

	const failed = outcomes?.filter((outcome) => !outcome.ok)

	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (running) return
				onOpenChange(value)
				setOutcomes(null)
			}}
		>
			<DialogContent showCloseButton={!running}>
				<DialogHeader>
					<DialogTitle>Republish this update</DialogTitle>
					<DialogDescription>
						Create a new update from this historical release for the {channel}{' '}
						channel. Clients running runtime {update.runtime_version} can then
						apply it normally. Existing R2 objects are reused.
					</DialogDescription>
				</DialogHeader>
				<div className='grid gap-2'>
					<label
						className='text-sm font-medium'
						htmlFor='republish-message'
					>
						New update name
					</label>
					<Input
						id='republish-message'
						maxLength={200}
						value={message}
						onChange={(event) => setMessage(event.target.value)}
					/>
				</div>
				<div className='overflow-hidden rounded-xl border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Platform</TableHead>
								<TableHead>Current head</TableHead>
								<TableHead>After republish</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const isCurrent =
									row.head?.mode === 'ota' &&
									headGroupID(row.head) === update.id
								const outcome = outcomes?.find(
									(item) => item.platform === row.platform,
								)
								return (
									<TableRow key={row.platform}>
										<TableCell>
											<Badge
												variant='secondary'
												className='capitalize'
											>
												{row.platform}
											</Badge>
										</TableCell>
										<TableCell>
											{pending ? (
												<span className='text-xs text-muted-foreground'>
													Checking…
												</span>
											) : (
												<HeadLabel
													groupId={update.id}
													head={row.head}
												/>
											)}
										</TableCell>
										<TableCell>
											{isCurrent ? (
												<span className='text-xs text-muted-foreground'>
													Unchanged
												</span>
											) : outcome ? (
												outcome.ok ? (
													<StatusBadge value='ota' />
												) : (
													<span className='text-xs text-destructive'>
														{outcome.message}
													</span>
												)
											) : (
												<Badge
													variant='outline'
													className='whitespace-nowrap'
												>
													This update
												</Badge>
											)}
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</div>
				{failed && failed.length > 0 && (
					<p className='text-sm text-destructive'>
						Republish failed on {failed.length}{' '}
						{failed.length === 1 ? 'platform' : 'platforms'}. Other platforms
						were updated.
					</p>
				)}
				{!pending && actionable.length === 0 && !outcomes && (
					<p className='text-sm text-muted-foreground'>
						This update is already the current head on every platform of this
						channel.
					</p>
				)}
				<DialogFooter>
					<Button
						disabled={running}
						variant='outline'
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					{running ? (
						<Button
							disabled
							variant='destructive'
						>
							<RotateCcwIcon />
							Republishing…
						</Button>
					) : outcomes === null ? (
						<Button
							disabled={
								pending || actionable.length === 0 || message.trim() === ''
							}
							variant='destructive'
							onClick={() => void run()}
						>
							<RotateCcwIcon />
							{`Republish to ${actionable.length} platform${actionable.length === 1 ? '' : 's'}`}
						</Button>
					) : (
						<Button onClick={() => onOpenChange(false)}>Done</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function EmbeddedDialog({
	update,
	headsQueryData,
	headsQueryPending,
	open,
	onOpenChange,
	queryClient,
}: {
	update: Detail
	headsQueryData: Head[] | undefined
	headsQueryPending: boolean
	open: boolean
	onOpenChange: (value: boolean) => void
	queryClient: QueryClient
}) {
	const channel = update.channel
	const [running, setRunning] = useState(false)
	const [outcomes, setOutcomes] = useState<RepublishOutcome[] | null>(null)
	const rows = update.platforms.map((item) => ({
		platform: item.platform,
		head: findHead(headsQueryData, update.runtime_version, item.platform),
	}))
	const actionable = rows.filter((row) => row.head?.mode !== 'embedded')
	const pending = headsQueryPending || headsQueryData === undefined

	async function run() {
		if (!channel) return
		setRunning(true)
		setOutcomes([])
		const result: RepublishOutcome[] = []
		for (const row of actionable) {
			try {
				await setChannelEmbedded(channel, {
					runtime_version: update.runtime_version,
					platform: row.platform,
					group_id: update.id,
				})
				result.push({ platform: row.platform, ok: true })
			} catch (error) {
				result.push({
					platform: row.platform,
					ok: false,
					message:
						error instanceof Error
							? error.message
							: 'Revert to embedded bundle failed',
				})
			}
		}
		setOutcomes(result)
		setRunning(false)
		void queryClient.invalidateQueries({ queryKey: ['heads', channel] })
		void queryClient.invalidateQueries({ queryKey: ['channel', channel] })
	}

	const failed = outcomes?.filter((outcome) => !outcome.ok)
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (running) return
				onOpenChange(value)
				setOutcomes(null)
			}}
		>
			<DialogContent showCloseButton={!running}>
				<DialogHeader>
					<DialogTitle>Revert to embedded bundle</DialogTitle>
					<DialogDescription>
						Stop serving this OTA update on the {channel} channel. Clients on
						runtime {update.runtime_version} receive Expo&apos;s embedded-bundle
						directive on their next update check.
					</DialogDescription>
				</DialogHeader>
				<div className='overflow-hidden rounded-xl border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Platform</TableHead>
								<TableHead>Current head</TableHead>
								<TableHead>After revert</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => {
								const outcome = outcomes?.find(
									(item) => item.platform === row.platform,
								)
								return (
									<TableRow key={row.platform}>
										<TableCell>
											<Badge
												variant='secondary'
												className='capitalize'
											>
												{row.platform}
											</Badge>
										</TableCell>
										<TableCell>
											{pending ? (
												<span className='text-xs text-muted-foreground'>
													Checking…
												</span>
											) : (
												<HeadLabel
													groupId={update.id}
													head={row.head}
												/>
											)}
										</TableCell>
										<TableCell>
											{row.head?.mode === 'embedded' || outcome?.ok ? (
												<StatusBadge value='embedded' />
											) : outcome ? (
												<span className='text-xs text-destructive'>
													{outcome.message}
												</span>
											) : (
												<StatusBadge value='embedded' />
											)}
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</div>
				{failed && failed.length > 0 && (
					<p className='text-sm text-destructive'>
						Revert failed on {failed.length}{' '}
						{failed.length === 1 ? 'platform' : 'platforms'}. Other platforms
						were updated.
					</p>
				)}
				{!pending && actionable.length === 0 && !outcomes && (
					<p className='text-sm text-muted-foreground'>
						Every platform in this update group already uses its embedded
						bundle.
					</p>
				)}
				<DialogFooter>
					<Button
						disabled={running}
						variant='outline'
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					{running ? (
						<Button
							disabled
							variant='destructive'
						>
							<Undo2Icon />
							Reverting…
						</Button>
					) : outcomes === null ? (
						<Button
							disabled={pending || actionable.length === 0}
							variant='destructive'
							onClick={() => void run()}
						>
							<Undo2Icon />
							{`Revert ${actionable.length} platform${actionable.length === 1 ? '' : 's'}`}
						</Button>
					) : (
						<Button onClick={() => onOpenChange(false)}>Done</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function Info({
	label,
	value,
	mono = false,
}: {
	label: string
	value: ReactNode
	mono?: boolean
}) {
	return (
		<div>
			<p className='text-xs font-medium text-muted-foreground'>{label}</p>
			<div className={`mt-1 break-all text-sm ${mono ? 'font-mono' : ''}`}>
				{value}
			</div>
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
					Launch bundles, bsdiff generation, and immutable static files.
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
							<BundleList platform={item} />
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

function BundleList({ platform }: { platform: Detail['platforms'][number] }) {
	return (
		<section className='mt-4'>
			<div className='mb-3 flex items-center gap-2'>
				<h3 className='text-sm font-semibold'>Bundles</h3>
				<Badge variant='secondary'>{platform.patches.length + 1}</Badge>
			</div>
			<div className='overflow-hidden rounded-lg border'>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Bundle</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className='text-right'>Size</TableHead>
							<TableHead className='hidden lg:table-cell'>Result</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell className='max-w-48'>
								<p className='truncate font-medium'>Launch bundle</p>
								<p
									className='mt-1 truncate font-mono text-xs text-muted-foreground'
									title={platform.launch_key}
								>
									{platform.launch_key}
								</p>
							</TableCell>
							<TableCell>
								<Badge variant='secondary'>Full bundle</Badge>
							</TableCell>
							<TableCell className='text-right tabular-nums'>
								{bytes(platform.launch_size)}
							</TableCell>
							<TableCell className='hidden text-muted-foreground lg:table-cell'>
								Ready to serve
							</TableCell>
						</TableRow>
						{platform.patches.map((patch) => (
							<TableRow key={patch.id}>
								<TableCell className='max-w-48'>
									<p className='truncate font-medium'>bsdiff patch</p>
									<p
										className='mt-1 truncate text-xs text-muted-foreground'
										title={patch.from_message || patch.from_update_id}
									>
										From {patch.from_message || patch.from_update_id}
									</p>
								</TableCell>
								<TableCell>
									<PatchStatusBadge status={patch.status} />
								</TableCell>
								<TableCell className='text-right tabular-nums'>
									{patch.size_bytes === undefined
										? '—'
										: bytes(patch.size_bytes)}
								</TableCell>
								<TableCell className='hidden text-xs text-muted-foreground lg:table-cell'>
									<PatchResult
										launchSize={platform.launch_size}
										patch={patch}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	)
}

function PatchStatusBadge({
	status,
}: {
	status: Detail['platforms'][number]['patches'][number]['status']
}) {
	const meta = {
		pending: { label: 'Pending', variant: 'secondary' },
		processing: { label: 'Processing', variant: 'outline' },
		ready: { label: 'Ready', variant: 'default' },
		failed: { label: 'Failed', variant: 'destructive' },
		not_beneficial: { label: 'Not beneficial', variant: 'outline' },
	} as const
	return <Badge variant={meta[status].variant}>{meta[status].label}</Badge>
}

function PatchResult({
	patch,
	launchSize,
}: {
	patch: Detail['platforms'][number]['patches'][number]
	launchSize: number
}) {
	if (patch.status === 'ready' && patch.size_bytes !== undefined) {
		return `Saves ${percent(Math.max(0, 1 - patch.size_bytes / launchSize))}`
	}
	if (patch.error) return patch.error
	if (patch.status === 'processing')
		return `Generating · attempt ${patch.attempts}`
	if (patch.status === 'pending') return 'Waiting for worker'
	return 'Skipped'
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
	const staticAssets = query.data.filter((asset) => !asset.is_launch)
	if (staticAssets.length === 0)
		return (
			<section className='mt-6'>
				<div className='mb-3 flex items-center gap-2'>
					<h3 className='text-sm font-semibold'>Assets</h3>
					<Badge variant='secondary'>0</Badge>
				</div>
				<EmptyState
					title='No static assets'
					description='This platform only contains its launch bundle.'
				/>
			</section>
		)
	return (
		<section className='mt-6'>
			<div className='mb-3 flex items-center gap-2'>
				<h3 className='text-sm font-semibold'>Assets</h3>
				<Badge variant='secondary'>{staticAssets.length}</Badge>
			</div>
			<div className='max-h-64 overflow-auto rounded-lg border'>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Asset</TableHead>
							<TableHead>Size</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{staticAssets.map((asset) => (
							<TableRow key={asset.id}>
								<TableCell className='max-w-48'>
									<p
										className='truncate font-mono text-xs'
										title={asset.asset_key}
									>
										{asset.asset_key}
									</p>
								</TableCell>
								<TableCell>{bytes(asset.size_bytes)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	)
}
