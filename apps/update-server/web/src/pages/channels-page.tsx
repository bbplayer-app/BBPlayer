import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { channels } from '@/api'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, PageSkeleton } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { formatDate, number } from '@/lib/utils'

export function ChannelsPage() {
	const query = useQuery({ queryKey: ['channels'], queryFn: channels })
	const [search, setSearch] = useState('')
	const filtered = useMemo(
		() =>
			query.data?.filter((item) =>
				item.channel.toLowerCase().includes(search.toLowerCase()),
			) ?? [],
		[query.data, search],
	)
	return (
		<AppShell active='channels'>
			<PageHeader
				title='Channels'
				description='Channels point each compatible runtime to its current update group.'
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
					<div className='relative mb-4 max-w-sm'>
						<Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
						<Input
							aria-label='Search channels'
							className='pl-9'
							onChange={(event) => setSearch(event.target.value)}
							placeholder='Search channels'
							value={search}
						/>
					</div>
					{filtered.length === 0 ? (
						<EmptyState
							title='No channels found'
							description={
								search
									? 'Try a different search term.'
									: 'Publish an update to create the first channel head.'
							}
						/>
					) : (
						<div className='overflow-hidden rounded-xl border'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Channel</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className='hidden sm:table-cell'>
											Runtimes
										</TableHead>
										<TableHead className='hidden lg:table-cell'>
											Last updated
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map((item) => (
										<TableRow key={item.channel}>
											<TableCell>
												<a
													className='font-medium hover:underline'
													href={`/channels/detail.html?channel=${encodeURIComponent(item.channel)}`}
												>
													{item.channel}
												</a>
											</TableCell>
											<TableCell>
												<Badge>Active</Badge>
											</TableCell>
											<TableCell className='hidden tabular-nums sm:table-cell'>
												{number(item.runtime_count)}
											</TableCell>
											<TableCell className='hidden text-muted-foreground lg:table-cell'>
												{formatDate(item.updated_at)}
											</TableCell>
										</TableRow>
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
