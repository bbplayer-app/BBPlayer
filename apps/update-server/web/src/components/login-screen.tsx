import { FormEvent, useState } from 'react'

import { verifyToken } from '@/api'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function LoginScreen({
	onAuthenticated,
}: {
	onAuthenticated: (token: string) => void
}) {
	const [token, setToken] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	async function handleSubmit(event: FormEvent) {
		event.preventDefault()
		setBusy(true)
		setError(null)
		try {
			if (await verifyToken(token)) {
				onAuthenticated(token)
			} else {
				setError('That token was not accepted. Try again.')
			}
		} catch {
			setError('Could not reach the server. Is it running?')
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className='flex min-h-svh items-center justify-center bg-muted/30 p-4'>
			<Card className='w-full max-w-sm'>
				<CardHeader className='items-center text-center'>
					<span
						aria-hidden='true'
						className='relative mb-2 size-14 overflow-hidden rounded-2xl'
					>
						<img
							alt=''
							className='absolute inset-0 size-full scale-[2.15] object-contain'
							src='/icon.png'
						/>
					</span>
					<CardTitle>BBPlayer OTA</CardTitle>
					<CardDescription>
						Sign in with the admin token to manage update operations.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className='flex flex-col gap-3'
						onSubmit={handleSubmit}
					>
						<Input
							autoComplete='current-password'
							autoFocus
							disabled={busy}
							onChange={(event) => setToken(event.target.value)}
							placeholder='Admin token'
							type='password'
							value={token}
						/>
						{error && (
							<p
								aria-live='polite'
								className='text-sm text-destructive'
							>
								{error}
							</p>
						)}
						<Button
							className='w-full'
							disabled={busy || token.trim() === ''}
							type='submit'
						>
							{busy ? 'Checking…' : 'Sign in'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}
