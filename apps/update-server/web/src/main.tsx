import './styles.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './app'

const client = new QueryClient({
	defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.querySelector('#root')!).render(
	<QueryClientProvider client={client}>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</QueryClientProvider>,
)
