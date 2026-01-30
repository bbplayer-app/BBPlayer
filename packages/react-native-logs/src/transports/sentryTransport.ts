import { transportFunctionType } from '../index'

type SentryTransportOptions = {
	SENTRY: {
		captureException: (msg: string | typeof Error) => void
		addBreadcrumb: (msg: string | { message: string }) => void
	}
	errorLevels?: string | Array<string>
}

const sentryTransport: transportFunctionType<SentryTransportOptions> = (
	props,
) => {
	if (!props) return false

	if (!props?.options?.SENTRY) {
		throw Error(
			`react-native-logs: sentryTransport - No sentry instance provided`,
		)
	}

	let isError = true

	if (props?.options?.errorLevels) {
		isError = false
		if (Array.isArray(props?.options?.errorLevels)) {
			if (props.options.errorLevels.includes(props.level.text)) {
				isError = true
			}
		} else {
			if (props.options.errorLevels === props.level.text) {
				isError = true
			}
		}
	}

	try {
		if (isError) {
			props.options.SENTRY.captureException(props.msg)
		} else {
			props.options.SENTRY.addBreadcrumb({ message: props.msg })
		}
		return true
	} catch (error) {
		throw Error(
			`react-native-logs: sentryTransport - Error oon send msg to Sentry`,
		)
	}
}

export { sentryTransport }
