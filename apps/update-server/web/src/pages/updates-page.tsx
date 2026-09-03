import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { groups } from '@/api'
import { AppShell } from '@/components/app-shell'
import { Identifier } from '@/components/identifier'
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
import { formatDate, sourceCommit } from '@/lib/utils'

export function UpdatesPage() {
	const query = useQuery({ queryKey: ['groups'], queryFn: groups })
	const [search, setSearch] = useState('')
	const filtered = useMemo(
		() =>
			query.data?.filter((item) =>
				[
					item.message,
					item.channel,
					item.runtime_version,
					item.app_version,
					item.id,
				].some((value) => value?.toLowerCase().includes(search.toLowerCase())),
			) ?? [],
		[query.data, search],
	)
	return (
		<AppShell active='updates'>
			<PageHeader
				title='Update groups'
				description='Every published OTA release, grouped across its platform-specific updates.'
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
					<div className='relative mb-4 max-w-md'>
						<Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
						<Input
							aria-label='Search update groups'
							className='pl-9'
							onChange={(event) => setSearch(event.target.value)}
							placeholder='Search message, channel, runtime, or ID'
							value={search}
						/>
					</div>
					{filtered.length === 0 ? (
						<EmptyState
							title='No update groups found'
							description={
								search
									? 'Try a different search term.'
									: 'Published OTA updates will appear here.'
							}
						/>
					) : (
						<div className='overflow-hidden rounded-xl border'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Update</TableHead>
										<TableHead>Channel</TableHead>
										<TableHead className='hidden sm:table-cell'>
											Runtime
										</TableHead>
										<TableHead className='hidden lg:table-cell'>
											Commit
										</TableHead>
										<TableHead className='hidden xl:table-cell'>ID</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map((item) => (
										<TableRow key={item.id}>
											<TableCell className='max-w-sm'>
												<a
													className='font-medium hover:underline'
													href={`/updates/detail.html?id=${encodeURIComponent(item.id)}`}
												>
													{item.message || 'Untitled update'}
												</a>
												<p className='mt-1 text-xs text-muted-foreground'>
													{formatDate(item.created_at)}
												</p>
											</TableCell>
											<TableCell>
												<Badge variant='secondary'>
													{item.channel || 'Unlinked'}
												</Badge>
											</TableCell>
											<TableCell className='hidden sm:table-cell'>
												<a
													className='font-mono text-xs hover:underline'
													href={`/runtimes/detail.html?runtime=${encodeURIComponent(item.runtime_version)}`}
												>
													{item.app_version || item.runtime_version}
												</a>
											</TableCell>
											<TableCell className='hidden font-mono text-xs lg:table-cell'>
												{sourceCommit(item.source)}
											</TableCell>
											<TableCell className='hidden xl:table-cell'>
												<Identifier value={item.id} />
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
