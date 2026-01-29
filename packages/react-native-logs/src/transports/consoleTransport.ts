import { transportFunctionType } from '../index'

const availableColors = {
	default: null,
	black: 30,
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34,
	magenta: 35,
	cyan: 36,
	white: 37,
	grey: 90,
	redBright: 91,
	greenBright: 92,
	yellowBright: 93,
	blueBright: 94,
	magentaBright: 95,
	cyanBright: 96,
	whiteBright: 97,
} as const

const resetColors = '\x1b[0m'

type Color = keyof typeof availableColors

export type ConsoleTransportOptions = {
	colors?: Record<string, Color>
	extensionColors?: Record<string, Color>
	consoleFunc?: (msg: string) => void
}

const consoleTransport: transportFunctionType<ConsoleTransportOptions> = (
	props,
) => {
	if (!props) return false

	let msg = props.msg
	let color

	if (
		props.options?.colors &&
		props.options.colors[props.level.text] &&
		availableColors[props.options.colors[props.level.text]]
	) {
		color = `\x1b[${availableColors[props.options.colors[props.level.text]]}m`
		msg = `${color}${msg}${resetColors}`
	}

	if (props.extension && props.options?.extensionColors) {
		let extensionColor = '\x1b[7m'

		const extColor = props.options.extensionColors[props.extension]
		if (extColor && availableColors[extColor]) {
			extensionColor = `\x1b[${availableColors[extColor] + 10}m`
		}

		let extStart = color ? resetColors + extensionColor : extensionColor
		let extEnd = color ? resetColors + color : resetColors
		msg = msg.replace(
			props.extension,
			`${extStart} ${props.extension} ${extEnd}`,
		)
	}

	if (props.options?.consoleFunc) {
		props.options.consoleFunc(msg.trim())
	} else {
		console.log(msg.trim())
	}

	return true
}

export { consoleTransport }
