import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { patches, type PatchEndpoint } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { bytes, formatDate } from '@/lib/utils'

const statusOrder = ['pending', 'processing', 'ready', 'failed', 'not_beneficial'] as const

const statusMeta: Record<(typeof statusOrder)[number], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
	pending: { label: 'Pending', variant: 'secondary' },
	processing: { label: 'Processing', variant: 'outline' },
	ready: { label: 'Ready', variant: 'default' },
	failed: { label: 'Failed', variant: 'destructive' },
	not_beneficial: { label: 'Not beneficial', variant: 'outline' },
}

export function PatchesPage() {
	const query = useQuery({
		queryKey: ['patches'],
		queryFn: patches,
		refetchInterval: 10_000,
	})
	const counts = useMemo(() => {
		const map: Record<string, number> = {}
		for (const patch of query.data ?? []) map[patch.status] = (map[patch.status] ?? 0) + 1
		return map
	}, [query.data])
	return (
		<AppShell active='patches'>
			<PageHeader
				title='Patches'
				description='Generation status of every bsdiff delta between platform updates.'
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
					<div className='mb-6 flex flex-wrap items-center gap-2'>
						{statusOrder.map((status) => (
							<Badge
								className='h-6 gap-1.5 px-2.5'
								key={status}
								variant={statusMeta[status].variant}
							>
								<span className='font-semibold tabular-nums'>{counts[status] ?? 0}</span>
								<span className='font-normal opacity-80'>{statusMeta[status].label}</span>
							</Badge>
						))}
					</div>
					{query.data!.length === 0 ? (
						<EmptyState
							title='No patches'
							description='Deltas appear here as soon as a new update can be diffed against an older one.'
						/>
					) : (
						<div className='overflow-hidden rounded-xl border'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Update path</TableHead>
										<TableHead>Platform</TableHead>
										<TableHead>Delta</TableHead>
										<TableHead className='hidden sm:table-cell'>Saving</TableHead>
										<TableHead className='hidden md:table-cell'>Attempts</TableHead>
										<TableHead className='hidden lg:table-cell'>Served</TableHead>
										<TableHead className='hidden xl:table-cell'>Updated</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{query.data!.map((patch) => (
										<PatchRow
											key={patch.id}
											patch={patch}
										/>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</>
			)}
		</AppShell>
	)
}

function PatchRow({ patch }: { patch: PatchEndpoint }) {
	const meta = statusMeta[patch.status]
	return (
		<TableRow>
			<TableCell className='max-w-xl align-top'>
				<div className='flex items-start gap-1.5'>
					<span
						className='min-w-0 truncate text-muted-foreground'
						title={patch.from.message || patch.from.version}
					>
						{patch.from.message || patch.from.version || 'Unknown update'}
					</span>
					<span className='shrink-0 text-muted-foreground'>→</span>
					<a
						className='min-w-0 truncate font-medium hover:underline'
						href={`/updates/detail.html?id=${encodeURIComponent(patch.to.group_id)}`}
						title={patch.to.message}
					>
						{patch.to.message || patch.to.version || 'Unknown update'}
					</a>
				</div>
				<p className='mt-1 text-xs text-muted-foreground'>
					{patch.to.channel || 'Unlinked'}
					{patch.to.channel && ' · '}
					{patch.to.version || patch.to.runtime_version}
				</p>
				<div className='mt-2 flex flex-wrap items-center gap-2'>
					<Badge variant={meta.variant}>
						{meta.label}
						{patch.attempts > 1 && patch.status === 'processing' && (
							<span className='opacity-80'> · retry</span>
						)}
					</Badge>
					{patch.error && (
						<span
							className='max-w-xs truncate font-mono text-xs text-muted-foreground'
							title={patch.error}
						>
							{patch.error}
						</span>
					)}
				</div>
			</TableCell>
			<TableCell className='align-top'>
				<Badge variant='outline'>{patch.platform}</Badge>
			</TableCell>
			<TableCell className='align-top font-mono text-xs tabular-nums'>
				{patch.size_bytes !== undefined ? bytes(patch.size_bytes) : '—'}
			</TableCell>
			<TableCell className='hidden align-top font-mono text-xs tabular-nums sm:table-cell'>
				{saving(patch) ?? '—'}
			</TableCell>
			<TableCell className='hidden align-top tabular-nums md:table-cell'>
				{patch.attempts}
			</TableCell>
			<TableCell className='hidden align-top tabular-nums lg:table-cell'>
				{patch.served_count}
			</TableCell>
			<TableCell className='hidden align-top text-xs text-muted-foreground xl:table-cell'>
				{formatDate(patch.updated_at)}
			</TableCell>
		</TableRow>
	)
}

function saving(patch: PatchEndpoint) {
	if (patch.size_bytes === undefined || patch.target_size <= 0 || patch.status === 'failed')
		return null
	return `${Math.max(0, Math.round((1 - patch.size_bytes / patch.target_size) * 1000) / 10)}%`
}
