import { BracesIcon } from 'lucide-react'

import { Identifier } from '@/components/identifier'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'

export function FingerprintMetadataDialog({
	hash,
	sources,
}: {
	hash: string
	sources: unknown
}) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className='w-fit'
					size='sm'
					variant='outline'
				>
					<BracesIcon />
					View metadata
				</Button>
			</DialogTrigger>
			<DialogContent className='max-h-[min(42rem,calc(100vh-2rem))] max-w-3xl gap-5 overflow-hidden p-0 sm:max-w-3xl'>
				<DialogHeader className='border-b px-6 pb-4 pt-6'>
					<DialogTitle>Fingerprint metadata</DialogTitle>
					<DialogDescription>
						Recorded sources used to calculate this fingerprint.
					</DialogDescription>
					<Identifier
						label='fingerprint'
						value={hash}
					/>
				</DialogHeader>
				<pre className='min-h-0 overflow-auto px-6 pb-6 font-mono text-xs leading-5 text-foreground'>
					{formatMetadata(sources)}
				</pre>
			</DialogContent>
		</Dialog>
	)
}

function formatMetadata(value: unknown) {
	if (value === null || value === undefined)
		return 'No fingerprint metadata was recorded.'
	return JSON.stringify(value, null, 2)
}
