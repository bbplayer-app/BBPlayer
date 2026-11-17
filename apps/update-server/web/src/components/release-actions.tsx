import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcwIcon, Undo2Icon } from 'lucide-react'
import { useState } from 'react'

import {
	headGroupID,
	heads,
	republishChannel,
	setChannelEmbedded,
	type Head,
	type Platform,
} from '@/api'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn, relativeTime } from '@/lib/utils'

export type ReleaseRef = {
	id: string
	channel: string
	runtime_version: string
	message: string
	created_at: string
	platforms: Platform[]
}

export type ReleaseAction = 'republish' | 'embedded'

type Outcome = { platform: Platform; ok: boolean; message?: string }

function findHead(data: Head[] | undefined, runtime: string, platform: string) {
	return data?.find(
		(item) => item.runtime_version === runtime && item.platform === platform,
	)
}

/**
 * Republishes a historical release (a rollback when it is older than the live
 * one) or reverts a runtime to its embedded bundle. With several candidates the
 * operator picks which release to republish.
 */
export function ReleaseActionDialog({
	action,
	candidates,
	open,
	onOpenChange,
}: {
	action: ReleaseAction
	candidates: ReleaseRef[]
	open: boolean
	onOpenChange: (value: boolean) => void
}) {
	const queryClient = useQueryClient()
	const [selectedID, setSelectedID] = useState(candidates[0]?.id ?? '')

	const target =
		candidates.find((item) => item.id === selectedID) ?? candidates[0]

	const [message, setMessage] = useState('')
	const [running, setRunning] = useState(false)
	const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)

	const headsQuery = useQuery({
		queryKey: ['heads', target?.channel],
		queryFn: () => heads(target?.channel ?? ''),
		enabled: open && Boolean(target?.channel),
	})

	if (!target) return null

	const pending = headsQuery.isPending
	const defaultMessage = `Republish ${target.message}`

	const actionable = target.platforms.filter((platform) => {
		const head = findHead(headsQuery.data, target.runtime_version, platform)

		return action === 'embedded'
			? head?.mode !== 'embedded'
			: !(head?.mode === 'ota' && head && headGroupID(head) === target.id)
	})

	async function run() {
		setRunning(true)
		const result: Outcome[] = []

		for (const platform of actionable) {
			try {
				if (action === 'embedded') {
					await setChannelEmbedded(target.channel, {
						runtime_version: target.runtime_version,
						platform,
						group_id: target.id,
					})
				} else {
					await republishChannel(target.channel, {
						runtime_version: target.runtime_version,
						platform,
						group_id: target.id,
						message: message.trim() || defaultMessage,
					})
				}

				result.push({ platform, ok: true })
			} catch (error) {
				result.push({
					platform,
					ok: false,
					message: error instanceof Error ? error.message : 'Request failed',
				})
			}
		}

		setOutcomes(result)
		setRunning(false)
		void queryClient.invalidateQueries()
	}

	const failed = outcomes?.filter((outcome) => !outcome.ok) ?? []
	const Icon = action === 'embedded' ? Undo2Icon : RotateCcwIcon

	const close = (value: boolean) => {
		if (running) return
		onOpenChange(value)

		if (!value) {
			setOutcomes(null)
			setMessage('')
		}
	}

	return (
		<Dialog
			onOpenChange={close}
			open={open}
		>
			<DialogContent showCloseButton={!running}>
				<DialogHeader>
					<DialogTitle>
						{action === 'embedded'
							? 'Revert to embedded bundle'
							: candidates.length > 1
								? 'Roll back'
								: 'Republish this release'}
					</DialogTitle>
					<DialogDescription>
						{action === 'embedded'
							? `Stop serving OTA updates to runtime ${target.runtime_version} on ${target.channel}. Devices fall back to the bundle shipped inside the app on their next update check.`
							: `Publish a copy of the selected release as the newest update for runtime ${target.runtime_version} on ${target.channel}. Devices pick it up on their next update check; existing assets are reused.`}
					</DialogDescription>
				</DialogHeader>
				{action === 'republish' && candidates.length > 1 && (
					<div
						className='max-h-64 space-y-1.5 overflow-y-auto'
						role='radiogroup'
					>
						{candidates.map((item) => (
							<button
								aria-checked={item.id === target.id}
								className={cn(
									'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60',
									item.id === target.id && 'border-brand bg-brand/5',
								)}
								disabled={running || outcomes !== null}
								key={item.id}
								onClick={() => setSelectedID(item.id)}
								role='radio'
								type='button'
							>
								<span className='min-w-0 truncate font-medium'>
									{item.message || 'Untitled release'}
								</span>
								<span className='shrink-0 text-xs text-muted-foreground'>
									{relativeTime(item.created_at)}
								</span>
							</button>
						))}
					</div>
				)}
				{action === 'republish' && (
					<div className='grid gap-2'>
						<label
							className='text-sm font-medium'
							htmlFor='republish-message'
						>
							Release message
						</label>
						<Input
							disabled={running || outcomes !== null}
							id='republish-message'
							maxLength={200}
							onChange={(event) => setMessage(event.target.value)}
							placeholder={defaultMessage}
							value={message}
						/>
					</div>
				)}
				<p className='text-sm text-muted-foreground'>
					{pending
						? 'Checking the current channel state…'
						: outcomes
							? failed.length > 0
								? `Failed on ${failed.map((item) => `${item.platform} (${item.message})`).join(', ')}.`
								: 'Done. Devices will receive the change on their next update check.'
							: actionable.length === 0
								? action === 'embedded'
									? 'This runtime already serves its embedded bundle.'
									: 'This release is already live on every platform.'
								: `Affects ${actionable.map((item) => (item === 'ios' ? 'iOS' : 'Android')).join(' and ')}.`}
				</p>
				<DialogFooter>
					{outcomes ? (
						<Button onClick={() => close(false)}>Close</Button>
					) : (
						<>
							<Button
								disabled={running}
								onClick={() => close(false)}
								variant='outline'
							>
								Cancel
							</Button>
							<Button
								disabled={running || pending || actionable.length === 0}
								onClick={() => void run()}
								variant='destructive'
							>
								<Icon />
								{running
									? 'Working…'
									: action === 'embedded'
										? 'Revert to embedded'
										: 'Republish'}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
