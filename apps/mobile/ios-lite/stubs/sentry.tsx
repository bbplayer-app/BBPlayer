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
export const appLoaded = noop
export const flush = async () => true
export const metrics = { distribution: noop }

// The app sets tags on the global scope, and clones the current scope to start a
// span with its own trace. Nothing is kept, so one scope serves both.
class Scope {
	setTag = noop
	setPropagationContext = noop

	clone() {
		return this
	}
}

const scope = new Scope()

export const getGlobalScope = () => scope
export const getCurrentScope = () => scope

export const reactNavigationIntegration = () => ({
	name: 'ReactNavigation',
	registerNavigationContainer: noop,
})

export const wrap = <T,>(component: T): T => component

// Like the span Sentry returns when tracing is off, it records nothing. Each call
// returns a new span, because the playback code compares spans to tell them apart.
class NonRecordingSpan {
	setAttribute = () => this
	setAttributes = () => this
	setStatus = () => this
	end = noop
}

export const startInactiveSpan = () => new NonRecordingSpan()

// No span is ever active. A span without a parent is its own root.
export const getActiveSpan = noop
export const getRootSpan = (span: NonRecordingSpan) => span

// For a span that records nothing, Sentry reports no op, no end time and no data.
export const spanToJSON = () => ({ data: {} })

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
