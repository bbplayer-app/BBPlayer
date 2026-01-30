import { transportFunctionType } from '../index'

export type CrashlyticsTransportOption = {
	CRASHLYTICS: {
		recordError: (error: Error | string, name?: string) => void
		log: (msg: string) => void
	}
	errorLevels?: string | Array<string>
}

const crashlyticsTransport: transportFunctionType<
	CrashlyticsTransportOption
> = (props) => {
	if (!props) return false

	if (!props?.options?.CRASHLYTICS) {
		throw new Error(
			`react-native-logs: crashlyticsTransport - No crashlytics instance provided`,
		)
	}

	let isError = false

	if (props?.options?.errorLevels) {
		isError = false
		const level = props.level.text
		const errorLevels = props.options.errorLevels

		const levelsToCheck = Array.isArray(errorLevels)
			? errorLevels
			: [errorLevels]
		if (levelsToCheck.includes(level)) {
			isError = true
		}
	}

	try {
		let msgToRecord: any = props.msg

		if (isError) {
			const errorToRecord =
				msgToRecord instanceof Error
					? msgToRecord
					: new Error(String(msgToRecord))

			props.options.CRASHLYTICS.recordError(
				errorToRecord,
				props.extension || undefined,
			)
		} else {
			props.options.CRASHLYTICS.log(String(msgToRecord))
		}
		return true
	} catch (error) {
		throw new Error(
			`react-native-logs: crashlyticsTransport - Error on send msg to crashlytics: ${error}`,
		)
	}
}

export { crashlyticsTransport }
