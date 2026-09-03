import type { CommandArguments } from '../types.js'

const BOOLEAN_ARGUMENT_NAMES = new Set([
	'json',
	'non-interactive',
	'allow-dirty',
	'no-fingerprint',
	'embedded',
	'skip-export',
])

export function parseCommandArguments(
	rawArguments: string[],
): CommandArguments {
	const parsedArguments: CommandArguments = {}

	for (let index = 0; index < rawArguments.length; index += 1) {
		const rawArgument = rawArguments[index]
		if (rawArgument === '--' || !rawArgument.startsWith('--')) continue

		const argumentName = rawArgument.slice(2)
		if (BOOLEAN_ARGUMENT_NAMES.has(argumentName)) {
			parsedArguments[argumentName] = true
			continue
		}

		const argumentValue = rawArguments[index + 1]
		if (!argumentValue || argumentValue.startsWith('--')) {
			throw new Error(`Missing value for --${argumentName}`)
		}

		parsedArguments[argumentName] = argumentValue
		index += 1
	}

	return parsedArguments
}
