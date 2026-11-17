import type { HistoryEntry, Platform } from '@/api'
import { cn, formatDate, relativeTime } from '@/lib/utils'

export function historyVerb(entry: HistoryEntry) {
	if (entry.action === 'revert_to_embedded' || entry.mode === 'embedded')
		return 'Reverted to embedded bundle'

	if (entry.action === 'republish' || entry.action === 'rollback')
		return 'Republished'

	return 'Published'
}

type Deployment = HistoryEntry & { platforms: Platform[] }

// One publish writes a history row per platform; show them as one deployment.
function groupDeployments(history: HistoryEntry[]) {
	const out: Deployment[] = []

	for (const entry of history) {
		const last = out.at(-1)

		if (
			last &&
			last.channel === entry.channel &&
			last.runtime_version === entry.runtime_version &&
			last.group_id === entry.group_id &&
			last.action === entry.action &&
			last.mode === entry.mode &&
			Math.abs(
				new Date(last.created_at).getTime() -
					new Date(entry.created_at).getTime(),
			) < 60_000
		) {
			last.platforms.push(entry.platform)
		} else out.push({ ...entry, platforms: [entry.platform] })
	}

	return out
}

export function HistoryList({ history }: { history: HistoryEntry[] }) {
	return (
		<ol className='relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border'>
			{groupDeployments(history).map((entry) => {
				const verb = historyVerb(entry)
				const embedded = verb.startsWith('Reverted')

				return (
					<li
						className='relative pl-6'
						key={entry.id}
					>
						<span
							className={cn(
								'absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-card',
								embedded
									? 'bg-warning'
									: entry.action === 'publish'
										? 'bg-brand'
										: 'bg-chart-3',
							)}
						/>
						<p className='text-xs text-muted-foreground'>
							<span className='font-medium text-foreground'>{verb}</span> to{' '}
							{entry.channel} ·{' '}
							<span title={`Runtime ${entry.runtime_version}`}>
								{entry.app_version.length > 16
									? `${entry.app_version.slice(0, 8)}…`
									: entry.app_version}
							</span>{' '}
							·{' '}
							{entry.platforms
								.map((item) => (item === 'ios' ? 'iOS' : 'Android'))
								.join(', ')}{' '}
							·{' '}
							<span title={formatDate(entry.created_at)}>
								{relativeTime(entry.created_at)}
							</span>
						</p>
						{entry.group_id && !embedded && (
							<a
								className='mt-0.5 block truncate text-sm font-medium hover:text-brand'
								href={`/releases/detail.html?id=${entry.group_id}`}
							>
								{entry.message || 'Untitled release'}
							</a>
						)}
					</li>
				)
			})}
		</ol>
	)
}
