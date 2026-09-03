import '@/styles.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { LoginScreen } from '@/components/login-screen'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
	clearToken,
	getToken,
	saveToken,
	setUnauthorizedHandler,
} from '@/lib/auth'

const client = new QueryClient({
	defaultOptions: {
		queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
	},
})

export function mount(page: ReactNode) {
	createRoot(document.querySelector('#root')!).render(
		<QueryClientProvider client={client}>
			<TooltipProvider>
				<Toaster
					closeButton
					position='bottom-right'
				/>
				<AuthGate>{page}</AuthGate>
			</TooltipProvider>
		</QueryClientProvider>,
	)
}

function AuthGate({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(() => getToken())

	useEffect(() => {
		setUnauthorizedHandler(() => {
			clearToken()
			setToken(null)
		})
		return () => setUnauthorizedHandler(null)
	}, [])

	if (token === null) {
		return (
			<LoginScreen
				onAuthenticated={(next) => {
					saveToken(next)
					setToken(next)
				}}
			/>
		)
	}
	return children
}
