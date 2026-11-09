import { Component, type ReactNode } from 'react'

const noop = () => undefined
const noopObject = new Proxy({}, { get: () => noop }) as Record<
	string,
	(...args: unknown[]) => unknown
>

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
export const getGlobalScope = () => noopObject
export const reactNavigationIntegration = () => ({
	name: 'ReactNavigation',
	registerNavigationContainer: noop,
})
export const wrap = <T,>(component: T): T => component

export function startSpan<T>(
	_options: unknown,
	callback: (span: typeof noopObject) => T,
): T {
	return callback(noopObject)
}

interface FallbackProps {
	error: unknown
	componentStack: string
	eventId: string
	resetError: () => void
}

interface ErrorBoundaryProps {
	children?: ReactNode
	fallback?: ReactNode | ((props: FallbackProps) => ReactNode)
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	{ error: unknown }
> {
	state = { error: null as unknown }

	static getDerivedStateFromError(error: unknown) {
		return { error }
	}

	resetError = () => {
		this.setState({ error: null })
	}

	render() {
		const { error } = this.state
		if (error === null) return this.props.children
		const { fallback } = this.props
		return typeof fallback === 'function'
			? fallback({
					error,
					componentStack: '',
					eventId: '',
					resetError: this.resetError,
				})
			: (fallback ?? null)
	}
}
