import { select } from '@clack/prompts'

import { promptForRequiredValue } from '../cli/prompts.js'
import { requestUpdateServer } from '../services/update-server.js'
import type { CommandArguments } from '../types.js'

function writeResult(argumentsMap: CommandArguments, result: unknown): void {
	if (argumentsMap.json) process.stdout.write(`${JSON.stringify(result)}\n`)
	else console.table(Array.isArray(result) ? result : [result])
}

export async function runAdminCommand(
	commandName: string,
	argumentsMap: CommandArguments,
): Promise<void> {
	if (commandName === 'list') {
		return writeResult(
			argumentsMap,
			await requestUpdateServer(
				argumentsMap,
				'GET',
				`/admin/updates?limit=${encodeURIComponent(String(argumentsMap.limit ?? 10))}&offset=${encodeURIComponent(String(argumentsMap.offset ?? 0))}`,
			),
		)
	}
	if (commandName === 'show') {
		const groupId = String(
			argumentsMap.group ?? (await promptForRequiredValue('Group ID')),
		)
		return writeResult(
			argumentsMap,
			await requestUpdateServer(argumentsMap, 'GET', `/admin/updates/${groupId}`),
		)
	}
	if (commandName === 'channel') return await runChannelCommand(argumentsMap)
	if (commandName === 'rollback') return await runRollbackCommand(argumentsMap)
	if (commandName === 'source') return await runSourceCommand(argumentsMap)
	if (commandName === 'insights') return await runInsightsCommand(argumentsMap)
	throw new Error(`Unknown command: ${commandName}`)
}

async function runChannelCommand(argumentsMap: CommandArguments): Promise<void> {
	const action = String(
		argumentsMap.action ??
			(!argumentsMap['non-interactive']
				? await select({
						message: 'Channel action',
						options: ['list', 'show', 'history'].map((value) => ({
							value,
							label: value,
						})),
					})
				: 'list'),
	)
	const channelName =
		action === 'list'
			? ''
			: String(argumentsMap.channel ?? (await promptForRequiredValue('Channel')))
	const path =
		action === 'list'
			? '/admin/channels'
			: `/admin/channels/${encodeURIComponent(channelName)}${action === 'history' ? '/history' : ''}`
	writeResult(argumentsMap, await requestUpdateServer(argumentsMap, 'GET', path))
}

async function runRollbackCommand(argumentsMap: CommandArguments): Promise<void> {
	const channelName = String(
		argumentsMap.channel ?? (await promptForRequiredValue('Channel')),
	)
	const runtimeVersion = String(
		argumentsMap['runtime-version'] ??
			(await promptForRequiredValue('Runtime version')),
	)
	const isEmbedded = argumentsMap.embedded === true
	const groupId = isEmbedded
		? ''
		: String(argumentsMap.to ?? (await promptForRequiredValue('Target group ID')))
	writeResult(
		argumentsMap,
		await requestUpdateServer(
			argumentsMap,
			'POST',
			`/admin/channels/${encodeURIComponent(channelName)}/rollback`,
			{
				runtime_version: runtimeVersion,
				platform: argumentsMap.platform ?? 'android',
				mode: isEmbedded ? 'embedded' : 'ota',
				group_id: groupId,
			},
		),
	)
}

async function runSourceCommand(argumentsMap: CommandArguments): Promise<void> {
	const action = String(
		argumentsMap.action ??
			(await select({
				message: 'Source action',
				options: [
					{ value: 'find', label: 'Find commit' },
					{ value: 'compare', label: 'Compare groups' },
				],
			})),
	)
	const path =
		action === 'compare'
			? `/admin/source/compare/${argumentsMap.from ?? (await promptForRequiredValue('From group'))}/${argumentsMap.to ?? (await promptForRequiredValue('To group'))}`
			: `/admin/source/${argumentsMap.commit ?? (await promptForRequiredValue('Commit SHA'))}`
	writeResult(argumentsMap, await requestUpdateServer(argumentsMap, 'GET', path))
}

async function runInsightsCommand(argumentsMap: CommandArguments): Promise<void> {
	const query = new URLSearchParams()
	for (const argumentName of [
		'channel',
		'runtime_version',
		'platform',
		'group_id',
	]) {
		const argumentValue = argumentsMap[argumentName]
		if (typeof argumentValue === 'string') query.set(argumentName, argumentValue)
	}
	writeResult(
		argumentsMap,
		await requestUpdateServer(argumentsMap, 'GET', `/admin/insights?${query}`),
	)
}
