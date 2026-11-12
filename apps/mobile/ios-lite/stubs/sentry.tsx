import { Component, type ReactNode } from 'react'

const noop = () => undefined

export type SeverityLevel =
	| 'fatal'
	| 'error'
	| 'warning'
	| 'log'
	| 'info'
	| 'debug'

export const init = noop
export const addBreadcrumb = noop
export const captureException = () => ''

// The app only sets tags on the global scope.
const globalScope = { setTag: noop }

export const getGlobalScope = () => globalScope

export const reactNavigationIntegration = () => ({
	name: 'ReactNavigation',
	registerNavigationContainer: noop,
})

export const wrap = <T,>(component: T): T => component

interface SpanOptions {
	name: string
	op?: string
}

// The app's span callbacks never use the span they are given.
export function startSpan<T>(_options: SpanOptions, callback: () => T): T {
	return callback()
}

interface FallbackProps {
	error: Error
	componentStack: string
	eventId: string
	resetError: () => void
}

interface ErrorBoundaryProps {
	children?: ReactNode
	fallback: (props: FallbackProps) => ReactNode
}

interface ErrorBoundaryState {
	error: Error | null
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { error: null }

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error }
	}

	resetError = () => {
		this.setState({ error: null })
	}

	render() {
		const { error } = this.state

		if (error === null) return this.props.children

		return this.props.fallback({
			error,
			componentStack: '',
			eventId: '',
			resetError: this.resetError,
		})
	}
}
