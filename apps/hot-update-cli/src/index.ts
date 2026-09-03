#!/usr/bin/env node
import { cancel, intro, isCancel, select } from '@clack/prompts'

import { parseCommandArguments } from './cli/arguments.js'
import { runAdminCommand } from './commands/admin.js'
import { showFingerprint } from './commands/fingerprint.js'
import { publishUpdate } from './commands/publish.js'

const COMMAND_NAMES = [
	'publish',
	'fingerprint',
	'list',
	'show',
	'channel',
	'rollback',
	'source',
	'insights',
] as const

async function selectCommandName(): Promise<string> {
	intro('BBPlayer hot update')
	const selectedCommand = await select({
		message: 'Action',
		options: COMMAND_NAMES.map((commandName) => ({
			value: commandName,
			label: commandName,
		})),
	})
	if (isCancel(selectedCommand)) throw new Error('Cancelled')
	return selectedCommand
}

async function main(): Promise<void> {
	const rawArguments = process.argv.slice(2)
	while (rawArguments[0] === '--') rawArguments.shift()
	const leadingArguments: string[] = []
	if (rawArguments[0] === '--project-dir') {
		leadingArguments.push(rawArguments.shift() ?? '--project-dir')
		const optionValue = rawArguments.shift()
		if (!optionValue) throw new Error('Missing value for --project-dir')
		leadingArguments.push(optionValue)
	}
	let [commandName, ...commandArguments] = rawArguments
	if (!commandName) commandName = await selectCommandName()

	const parsedArguments = parseCommandArguments([
		...leadingArguments,
		...commandArguments,
	])
	if (commandName === 'publish') return await publishUpdate(parsedArguments)
	if (commandName === 'fingerprint')
		return await showFingerprint(parsedArguments)
	return await runAdminCommand(commandName, parsedArguments)
}

void main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	if (message === 'Cancelled') cancel('Cancelled')
	else console.error(message)
	process.exitCode = 1
})
