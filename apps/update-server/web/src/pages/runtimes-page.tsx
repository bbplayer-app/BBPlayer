import { useQuery } from '@tanstack/react-query'

import { runtimes } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { formatDate, number } from '@/lib/utils'

export function RuntimesPage() {
	const query = useQuery({ queryKey: ['runtimes'], queryFn: runtimes })
	return (
		<AppShell active='runtimes'>
			<PageHeader
				title='Runtimes'
				description='Compatibility boundaries shared by native builds and OTA update groups.'
			/>
			{query.isPending ? (
				<PageSkeleton />
			) : query.error ? (
				<ErrorState
					error={query.error}
					retry={() => void query.refetch()}
				/>
			) : query.data.length === 0 ? (
				<EmptyState
					title='No runtimes'
					description='A runtime will appear after the first update is published.'
				/>
			) : (
				<div className='overflow-hidden rounded-xl border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Runtime</TableHead>
								<TableHead>App version</TableHead>
								<TableHead className='hidden sm:table-cell'>Channels</TableHead>
								<TableHead className='hidden lg:table-cell'>
									Update groups
								</TableHead>
								<TableHead className='hidden xl:table-cell'>
									Latest update
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.map((item) => (
								<TableRow key={item.runtime_version}>
									<TableCell>
										<a
											className='font-mono text-xs font-medium hover:underline'
											href={`/runtimes/detail.html?runtime=${encodeURIComponent(item.runtime_version)}`}
										>
											{item.runtime_version}
										</a>
									</TableCell>
									<TableCell>{item.version || '—'}</TableCell>
									<TableCell className='hidden sm:table-cell'>
										{item.channels.filter(Boolean).join(', ') || 'Unlinked'}
									</TableCell>
									<TableCell className='hidden tabular-nums lg:table-cell'>
										{number(item.update_count)}
									</TableCell>
									<TableCell className='hidden text-muted-foreground xl:table-cell'>
										{formatDate(item.updated_at)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</AppShell>
	)
}
