import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Repeat, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { releases, type Release } from '@/api'
import { AppShell } from '@/components/app-shell'
import { CrashRate, LiveBadge } from '@/components/badges'
import { CommitLink } from '@/components/commit-link'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, number, queryParam, relativeTime } from '@/lib/utils'

type RuntimeGroup = {
	key: string
	channel: string
	runtime: string
	version: string
	releases: Release[]
}

function groupByRuntime(items: Release[]) {
	const groups = new Map<string, RuntimeGroup>()

	// Releases arrive newest first, so groups are ordered by their latest release.
	for (const item of items) {
		const key = `${item.channel}\u0000${item.runtime_version}`
		let group = groups.get(key)

		if (!group) {
			group = {
				key,
				channel: item.channel,
				runtime: item.runtime_version,
				version: item.app_version || item.runtime_version,
				releases: [],
			}
			groups.set(key, group)
		}

		group.releases.push(item)
	}

	return [...groups.values()]
}

export function ReleasesPage() {
	const query = useQuery({ queryKey: ['releases'], queryFn: releases })
	const [search, setSearch] = useState(() => queryParam('q'))
	const [channel, setChannel] = useState(() => queryParam('channel'))

	const channels = useMemo(
		() => [...new Set(query.data?.map((item) => item.channel))].sort(),
		[query.data],
	)

	const groups = useMemo(() => {
		const needle = search.trim().toLowerCase()

		const filtered = (query.data ?? []).filter(
			(item) =>
				(!channel || item.channel === channel) &&
				(!needle ||
					[
						item.message,
						item.runtime_version,
						item.app_version,
						item.commit_sha,
						item.id,
					].some((value) => value.toLowerCase().includes(needle))),
		)

		return groupByRuntime(filtered)
	}, [query.data, search, channel])

	return (
		<AppShell active='releases'>
			<PageHeader
				title='Releases'
				description='Every OTA update, grouped by the native version it targets. Only devices on that exact runtime can install it.'
			/>
			{query.isPending ? (
				<PageSkeleton />
			) : query.error ? (
				<ErrorState
					error={query.error}
					retry={() => void query.refetch()}
				/>
			) : (
				<>
					<div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center'>
						<div className='relative flex-1 sm:max-w-sm'>
							<Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
							<Input
								aria-label='Search releases'
								className='pl-9'
								onChange={(event) => setSearch(event.target.value)}
								placeholder='Search message, version, commit or ID'
								value={search}
							/>
						</div>
						{channels.length > 1 && (
							<Tabs
								onValueChange={(value) =>
									setChannel(value === 'all' ? '' : value)
								}
								value={channel || 'all'}
							>
								<TabsList>
									<TabsTrigger value='all'>All channels</TabsTrigger>
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
						)}
					</div>
					{groups.length === 0 ? (
						<EmptyState
							title={query.data.length === 0 ? 'No releases yet' : 'No matches'}
							description={
								query.data.length === 0
									? 'Run `pnpm hot-update` in apps/mobile to publish the first OTA update.'
									: 'Try a different search term or channel.'
							}
						/>
					) : (
						<div className='space-y-8'>
							{groups.map((group) => (
								<RuntimeSection
									group={group}
									key={group.key}
									showChannel={channels.length > 1}
								/>
							))}
						</div>
					)}
				</>
			)}
		</AppShell>
	)
}

function RuntimeSection({
	group,
	showChannel,
}: {
	group: RuntimeGroup
	showChannel: boolean
}) {
	return (
		<section>
			<div className='mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1'>
				<h2 className='text-base font-semibold'>{group.version}</h2>
				{group.runtime !== group.version && (
					<span
						className='max-w-56 truncate font-mono text-xs text-muted-foreground'
						title={group.runtime}
					>
						runtime {group.runtime}
					</span>
				)}
				{showChannel && <Badge variant='outline'>{group.channel}</Badge>}
				<span className='text-xs text-muted-foreground'>
					{group.releases.length} release
					{group.releases.length === 1 ? '' : 's'}
				</span>
			</div>
			<div className='divide-y overflow-hidden rounded-xl border bg-card'>
				{group.releases.map((item) => (
					<ReleaseRow
						item={item}
						key={item.id}
					/>
				))}
			</div>
		</section>
	)
}

function ReleaseRow({ item }: { item: Release }) {
	const live = item.live_platforms.length > 0

	return (
		<a
			className='group grid gap-x-6 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5'
			href={`/releases/detail.html?id=${item.id}`}
		>
			<div className='min-w-0'>
				<div className='flex min-w-0 items-center gap-2'>
					<span className='truncate font-medium group-hover:text-brand'>
						{item.message || 'Untitled release'}
					</span>
					{live && <LiveBadge />}
				</div>
				<div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
					<span title={formatDate(item.created_at)}>
						{relativeTime(item.created_at)}
					</span>
					<CommitLink sha={item.commit_sha} />
					{item.republished_from_group_id && (
						<span className='inline-flex items-center gap-1'>
							<Repeat className='size-3' />
							Republished
						</span>
					)}
				</div>
			</div>
			<div className='flex items-center gap-6 text-sm'>
				<Metric
					label='Devices · 7d'
					value={number(item.active_users)}
				/>
				<Metric
					label='Launches'
					value={number(item.launches)}
				/>
				<div className='w-16'>
					<p className='text-xs text-muted-foreground'>Crashes</p>
					<CrashRate
						className='text-sm'
						crashes={item.crashes}
						launches={item.launches}
					/>
				</div>
				<ChevronRight className='hidden size-4 text-muted-foreground sm:block' />
			</div>
		</a>
	)
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className='w-20'>
			<p className='text-xs text-muted-foreground'>{label}</p>
			<p className='tabular-nums'>{value}</p>
		</div>
	)
}
