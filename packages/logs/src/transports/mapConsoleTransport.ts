import { transportFunctionType } from '../index'

type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | (string & {})
type LogLevel = string

export type MapConsoleTransportOptions = {
	mapLevels?: Record<LogLevel, ConsoleMethod>
}
const mapConsoleTransport: transportFunctionType<MapConsoleTransportOptions> = (
	props,
) => {
	if (!props) return false

	let logMethod = 'log'

	if (props.options?.mapLevels && props.options.mapLevels[props.level.text]) {
		logMethod = props.options.mapLevels[props.level.text]
	} else {
		logMethod = props.level.text
	}

	if ((console as any)[logMethod]) {
		;(console as any)[logMethod](props.msg)
	} else {
		console.log(props.msg)
	}

	return true
}

export { mapConsoleTransport }
