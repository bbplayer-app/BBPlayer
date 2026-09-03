import { BracesIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import {
	oneDark,
	oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

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

SyntaxHighlighter.registerLanguage('json', json)

export function FingerprintMetadataDialog({
	hash,
	sources,
}: {
	hash: string
	sources: unknown
}) {
	const dark = useDarkMode()
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
			<DialogContent className='flex h-dvh w-dvw max-w-none flex-col gap-0 overflow-hidden p-0'>
				<DialogHeader className='shrink-0 border-b bg-muted/30 px-5 py-5 pr-14 sm:px-8 sm:pr-16'>
					<DialogTitle>Fingerprint metadata</DialogTitle>
					<DialogDescription>
						Every source record used to calculate this fingerprint.
					</DialogDescription>
					<Identifier
						label='fingerprint'
						value={hash}
					/>
				</DialogHeader>
				<div className='min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8'>
					<div className='min-w-max overflow-hidden rounded-xl border bg-muted/40'>
						<div className='border-b px-4 py-2 text-xs font-medium text-muted-foreground'>
							JSON source records
						</div>
						<SyntaxHighlighter
							customStyle={{
								background: 'transparent',
								margin: 0,
								padding: '1.25rem 1.5rem',
							}}
							language='json'
							showLineNumbers
							style={dark ? oneDark : oneLight}
						>
							{formatMetadata(sources)}
						</SyntaxHighlighter>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function useDarkMode() {
	const [dark, setDark] = useState(() =>
		document.documentElement.classList.contains('dark'),
	)

	useEffect(() => {
		const root = document.documentElement
		const observer = new MutationObserver(() =>
			setDark(root.classList.contains('dark')),
		)
		observer.observe(root, { attributes: true, attributeFilter: ['class'] })
		return () => observer.disconnect()
	}, [])

	return dark
}

function formatMetadata(value: unknown) {
	if (value === null || value === undefined)
		return 'No fingerprint metadata was recorded.'
	return JSON.stringify(value, null, 2)
}
