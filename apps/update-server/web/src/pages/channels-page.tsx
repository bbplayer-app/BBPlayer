import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, RotateCcwIcon, Undo2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { history, overview, releases, type FleetRow, type Release } from '@/api'
import { AppShell } from '@/components/app-shell'
import { HeadModeBadge, PlatformLabel } from '@/components/badges'
import { CommitLink } from '@/components/commit-link'
import { HistoryList } from '@/components/history-list'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import {
	ReleaseActionDialog,
	type ReleaseAction,
	type ReleaseRef,
} from '@/components/release-actions'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, number, queryParam, relativeTime } from '@/lib/utils'

type PendingAction = { action: ReleaseAction; candidates: ReleaseRef[] }

function toRef(item: Release): ReleaseRef {
	return {
		id: item.id,
		channel: item.channel,
		runtime_version: item.runtime_version,
		message: item.message,
		created_at: item.created_at,
		platforms: item.platforms,
	}
}

export function ChannelsPage() {
	const overviewQuery = useQuery({ queryKey: ['overview'], queryFn: overview })
	const releasesQuery = useQuery({ queryKey: ['releases'], queryFn: releases })

	const channels = useMemo(() => {
		const totals = new Map<string, number>()

		for (const row of overviewQuery.data?.fleet ?? [])
			totals.set(row.channel, (totals.get(row.channel) ?? 0) + row.active_users)

		return [...totals].sort((a, b) => b[1] - a[1]).map(([name]) => name)
	}, [overviewQuery.data])

	const [selected, setSelected] = useState(() => queryParam('channel'))
	const channel = channels.includes(selected) ? selected : (channels[0] ?? '')

	const select = (value: string) => {
		setSelected(value)
		window.history.replaceState(
			null,
			'',
			`?channel=${encodeURIComponent(value)}`,
		)
	}

	const queries = [overviewQuery, releasesQuery]
	const failed = queries.find((query) => query.error)

	return (
		<AppShell active='channels'>
			<PageHeader
				title='Channels'
				description='What each channel serves to every native version. Roll back to an earlier release or stop serving OTA updates from here.'
				action={
					channels.length > 1 && (
						<Tabs
							onValueChange={select}
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
					)
				}
			/>
			{queries.some((query) => query.isPending) ? (
				<PageSkeleton />
			) : failed ? (
				<ErrorState
					error={failed.error}
					retry={() => void failed.refetch()}
				/>
			) : channels.length === 0 ? (
				<EmptyState
					title='No channels yet'
					description='A channel appears after its first published update or device activity.'
				/>
			) : (
				<ChannelView
					channel={channel}
					fleet={overviewQuery.data!.fleet.filter(
						(row) => row.channel === channel,
					)}
					releases={releasesQuery.data!.filter(
						(item) => item.channel === channel,
					)}
				/>
			)}
		</AppShell>
	)
}

function ChannelView({
	channel,
	fleet,
	releases: channelReleases,
}: {
	channel: string
	fleet: FleetRow[]
	releases: Release[]
}) {
	const [pending, setPending] = useState<PendingAction | null>(null)

	const historyQuery = useQuery({
		queryKey: ['history', channel],
		queryFn: () => history(channel),
	})

	return (
		<div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
			<Card className='h-fit'>
				<CardHeader>
					<CardTitle>Deployments</CardTitle>
					<CardDescription>
						One row per native version. Devices only receive releases built for
						their exact runtime.
					</CardDescription>
				</CardHeader>
				<CardContent className='px-0'>
					<div className='divide-y border-t'>
						{fleet.map((row) => (
							<DeploymentRow
								candidates={channelReleases
									.filter(
										(item) =>
											item.runtime_version === row.runtime_version &&
											item.platforms.includes(row.platform) &&
											item.id !== row.head_group_id,
									)
									.map(toRef)}
								head={channelReleases.find(
									(item) => item.id === row.head_group_id,
								)}
								key={`${row.runtime_version}-${row.platform}`}
								onAction={setPending}
								row={row}
							/>
						))}
					</div>
				</CardContent>
			</Card>
			<Card className='h-fit'>
				<CardHeader>
					<CardTitle>History</CardTitle>
					<CardDescription>
						Every change to what {channel} serves.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{historyQuery.isPending ? (
						<div className='h-48 animate-pulse rounded-lg bg-muted' />
					) : historyQuery.error ? (
						<ErrorState
							error={historyQuery.error}
							retry={() => void historyQuery.refetch()}
						/>
					) : historyQuery.data.length === 0 ? (
						<p className='text-sm text-muted-foreground'>No deployments yet.</p>
					) : (
						<HistoryList history={historyQuery.data} />
					)}
				</CardContent>
			</Card>
			{pending && (
				<ReleaseActionDialog
					action={pending.action}
					candidates={pending.candidates}
					onOpenChange={(open) => !open && setPending(null)}
					open
				/>
			)}
		</div>
	)
}

function DeploymentRow({
	row,
	head,
	candidates,
	onAction,
}: {
	row: FleetRow
	head: Release | undefined
	candidates: ReleaseRef[]
	onAction: (action: PendingAction) => void
}) {
	const live = row.head_mode === 'ota' && row.head_group_id

	return (
		<div className='flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center'>
			<div className='w-40 shrink-0'>
				<div className='flex items-baseline gap-2'>
					<span className='font-semibold'>
						{row.app_version || row.runtime_version}
					</span>
					<PlatformLabel platform={row.platform} />
				</div>
				<p className='mt-0.5 text-xs text-muted-foreground tabular-nums'>
					{number(row.active_users)} devices · 7d
				</p>
			</div>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-2'>
					<HeadModeBadge mode={row.head_mode} />
					{row.head_updated_at && (
						<span
							className='text-xs text-muted-foreground'
							title={formatDate(row.head_updated_at)}
						>
							since {relativeTime(row.head_updated_at)}
						</span>
					)}
				</div>
				{live && (
					<div className='mt-1 flex min-w-0 items-center gap-2'>
						<a
							className='truncate text-sm font-medium hover:text-brand'
							href={`/releases/detail.html?id=${row.head_group_id}`}
							title={row.head_message}
						>
							{row.head_message || 'Untitled release'}
						</a>
						<CommitLink sha={row.head_commit_sha} />
					</div>
				)}
			</div>
			<div className='flex shrink-0 items-center gap-2'>
				{candidates.length > 0 && (
					<Button
						onClick={() => onAction({ action: 'republish', candidates })}
						size='sm'
						variant='outline'
					>
						<RotateCcwIcon />
						{live ? 'Roll back' : 'Republish'}
					</Button>
				)}
				{live && head && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								aria-label='More actions'
								size='icon-sm'
								variant='ghost'
							>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem
								onSelect={() =>
									onAction({ action: 'embedded', candidates: [toRef(head)] })
								}
								variant='destructive'
							>
								<Undo2Icon />
								Revert to embedded bundle
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</div>
	)
}
