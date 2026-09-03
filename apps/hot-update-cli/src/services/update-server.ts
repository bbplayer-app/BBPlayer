import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { CommandArguments, UpdateServerCredentials } from '../types.js'
import {
	promptForRequiredValue,
	promptForSecretValue,
} from '../cli/prompts.js'
import { resolveProjectDirectory } from './project.js'

const CREDENTIALS_FILE_NAME = 'credentials.json'

function isUpdateServerCredentials(
	value: unknown,
): value is UpdateServerCredentials {
	if (!value || typeof value !== 'object') return false
	const credentials = value as Record<string, unknown>
	return (
		typeof credentials.serverUrl === 'string' &&
		credentials.serverUrl.trim().length > 0 &&
		typeof credentials.accessToken === 'string' &&
		credentials.accessToken.trim().length > 0
	)
}

async function getCredentialsFilePath(
	argumentsMap: CommandArguments,
): Promise<string> {
	const projectDirectory = await resolveProjectDirectory(
		argumentsMap['project-dir'],
	)
	return join(projectDirectory, '.bbplayer-updates', CREDENTIALS_FILE_NAME)
}

async function readSavedCredentials(
	credentialsFilePath: string,
): Promise<UpdateServerCredentials | undefined> {
	try {
		const contents = await readFile(credentialsFilePath, 'utf8')
		const credentials: unknown = JSON.parse(contents)
		if (!isUpdateServerCredentials(credentials)) {
			throw new Error('missing serverUrl or accessToken')
		}
		return {
			serverUrl: credentials.serverUrl.trim().replace(/\/$/, ''),
			accessToken: credentials.accessToken.trim(),
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
		const reason = error instanceof Error ? error.message : String(error)
		throw new Error(
			`Unable to read saved update credentials at ${credentialsFilePath}: ${reason}`,
		)
	}
}

async function saveCredentials(
	credentialsFilePath: string,
	credentials: UpdateServerCredentials,
): Promise<void> {
	const credentialsDirectory = dirname(credentialsFilePath)
	const temporaryFilePath = `${credentialsFilePath}.tmp`
	await mkdir(credentialsDirectory, { recursive: true, mode: 0o700 })
	await chmod(credentialsDirectory, 0o700)
	await writeFile(
		temporaryFilePath,
		`${JSON.stringify(credentials, null, '\t')}\n`,
		{ mode: 0o600 },
	)
	await rename(temporaryFilePath, credentialsFilePath)
	await chmod(credentialsFilePath, 0o600)
}

export async function getUpdateServerCredentials(
	argumentsMap: CommandArguments,
): Promise<UpdateServerCredentials> {
	const credentialsFilePath = await getCredentialsFilePath(argumentsMap)
	const savedCredentials = await readSavedCredentials(credentialsFilePath)
	let serverUrl = String(
		argumentsMap.server ??
			process.env.BBPLAYER_UPDATE_SERVER_URL ??
			savedCredentials?.serverUrl ??
			'',
	)
	let accessToken = String(
		argumentsMap.token ??
			process.env.BBPLAYER_UPDATE_SERVER_TOKEN ??
			savedCredentials?.accessToken ??
			'',
	)
	serverUrl = serverUrl.trim()
	accessToken = accessToken.trim()

	if (!argumentsMap['non-interactive']) {
		serverUrl ||= await promptForRequiredValue('Update server URL')
		accessToken ||= await promptForSecretValue('Admin token')
	}
	if (!serverUrl || !accessToken) {
		throw new Error('--server and --token are required')
	}

	const credentials = {
		serverUrl: serverUrl.replace(/\/$/, ''),
		accessToken,
	}
	await saveCredentials(credentialsFilePath, credentials)
	return credentials
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
