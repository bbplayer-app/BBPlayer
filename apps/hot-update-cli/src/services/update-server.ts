import type { CommandArguments, UpdateServerCredentials } from '../types.js'
import {
	promptForRequiredValue,
	promptForSecretValue,
} from '../cli/prompts.js'

export async function getUpdateServerCredentials(
	argumentsMap: CommandArguments,
): Promise<UpdateServerCredentials> {
	let serverUrl = String(
		argumentsMap.server ?? process.env.BBPLAYER_UPDATE_SERVER_URL ?? '',
	)
	let accessToken = String(
		argumentsMap.token ?? process.env.BBPLAYER_UPDATE_SERVER_TOKEN ?? '',
	)

	if (!argumentsMap['non-interactive']) {
		serverUrl ||= await promptForRequiredValue('Update server URL')
		accessToken ||= await promptForSecretValue('Admin token')
	}
	if (!serverUrl || !accessToken) {
		throw new Error('--server and --token are required')
	}

	return { serverUrl: serverUrl.replace(/\/$/, ''), accessToken }
}

export async function requestUpdateServer(
	argumentsMap: CommandArguments,
	method: string,
	path: string,
	body?: unknown,
): Promise<unknown> {
	const credentials = await getUpdateServerCredentials(argumentsMap)
	const response = await fetch(credentials.serverUrl + path, {
		method,
		headers: {
			Authorization: `Bearer ${credentials.accessToken}`,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	})
	const responseText = await response.text()
	if (!response.ok) throw new Error(`${response.status}: ${responseText}`)
	return responseText ? JSON.parse(responseText) : null
}
