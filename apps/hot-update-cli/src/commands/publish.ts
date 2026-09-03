import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import { confirm, isCancel, log, note, spinner } from '@clack/prompts'
import { createFingerprintAsync } from '@expo/fingerprint'

import { promptForRequiredValue } from '../cli/prompts.js'
import { createZipArchive } from '../services/archive.js'
import {
	ensureExpoExportExists,
	exportAndroidUpdate,
	getPublicExpoConfig,
} from '../services/expo.js'
import { runGitCommand } from '../services/git.js'
import { resolveProjectDirectory } from '../services/project.js'
import { getUpdateServerCredentials } from '../services/update-server.js'
import type { CommandArguments, Fingerprint } from '../types.js'

interface PublicExpoConfig {
	version?: unknown
	android?: {
		runtimeVersion?: unknown
	}
}

function isAppVersionPolicy(runtimeVersion: unknown): boolean {
	return (
		typeof runtimeVersion === 'object' &&
		runtimeVersion !== null &&
		'policy' in runtimeVersion &&
		runtimeVersion.policy === 'appVersion'
	)
}

function writeResult(argumentsMap: CommandArguments, result: unknown): void {
	if (argumentsMap.json) process.stdout.write(`${JSON.stringify(result)}\n`)
	else console.table(Array.isArray(result) ? result : [result])
}

async function getRuntimeVersion(
	projectDirectory: string,
	argumentsMap: CommandArguments,
): Promise<{ runtimeVersion: string; fingerprint?: Fingerprint }> {
	let runtimeVersion = String(argumentsMap['runtime-version'] ?? '')
	const publicConfig = JSON.parse(
		await getPublicExpoConfig(projectDirectory),
	) as PublicExpoConfig
	if (isAppVersionPolicy(publicConfig.android?.runtimeVersion)) {
		if (typeof publicConfig.version !== 'string' || !publicConfig.version) {
			throw new Error(
				'Expo config appVersion policy requires a non-empty version',
			)
		}
		if (runtimeVersion && runtimeVersion !== publicConfig.version) {
			throw new Error(
				`runtimeVersion must equal app version (${publicConfig.version}) for appVersion policy`,
			)
		}
		return { runtimeVersion: publicConfig.version }
	}
	if (argumentsMap['no-fingerprint']) {
		if (!runtimeVersion) {
			throw new Error('--runtime-version is required with --no-fingerprint')
		}
		return { runtimeVersion }
	}

	const progress = spinner()
	progress.start('Generating Android fingerprint')
	try {
		const fingerprint = await createFingerprintAsync(projectDirectory, {
			platforms: ['android'],
			silent: true,
		})
		runtimeVersion ||= fingerprint.hash
		if (runtimeVersion !== fingerprint.hash) {
			throw new Error(
				'fingerprint hash must equal runtimeVersion when fingerprint is uploaded',
			)
		}
		progress.stop(`Fingerprint: ${runtimeVersion}`)
		return { runtimeVersion, fingerprint }
	} catch (error) {
		progress.stop('Fingerprint generation failed')
		throw error
	}
}

async function uploadUpdate(
	argumentsMap: CommandArguments,
	archivePath: string,
	payload: Record<string, unknown>,
): Promise<void> {
	const credentials = await getUpdateServerCredentials(argumentsMap)
	const formData = new FormData()
	formData.set('request', JSON.stringify(payload))
	formData.set(
		'archive',
		new Blob([await readFile(archivePath)], { type: 'application/zip' }),
		basename(archivePath),
	)

	const response = await fetch(`${credentials.serverUrl}/admin/publish`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${credentials.accessToken}` },
		body: formData,
	})
	const responseText = await response.text()
	if (!response.ok) throw new Error(`${response.status}: ${responseText}`)
	writeResult(argumentsMap, JSON.parse(responseText))
}

export async function publishUpdate(
	argumentsMap: CommandArguments,
): Promise<void> {
	const projectDirectory = await resolveProjectDirectory(
		argumentsMap['project-dir'],
	)
	const isNonInteractive = argumentsMap['non-interactive'] === true
	const shouldSkipExport = argumentsMap['skip-export'] === true
	let channelName = String(argumentsMap.channel ?? 'production')
	let releaseMessage = String(argumentsMap.message ?? '')

	if (!isNonInteractive) {
		channelName = await promptForRequiredValue('Channel', channelName)
		releaseMessage ||= await runGitCommand(projectDirectory, [
			'log',
			'-1',
			'--format=%s',
		])
		releaseMessage = await promptForRequiredValue(
			'Release message',
			releaseMessage,
		)
	}
	if (!releaseMessage) throw new Error('--message is required')

	const commitSha = await runGitCommand(projectDirectory, ['rev-parse', 'HEAD'])
	const hasUncommittedChanges = Boolean(
		await runGitCommand(projectDirectory, ['status', '--porcelain']),
	)
	if (
		hasUncommittedChanges &&
		isNonInteractive &&
		!argumentsMap['allow-dirty']
	) {
		throw new Error('Dirty worktree; use --allow-dirty explicitly')
	}
	if (hasUncommittedChanges && !isNonInteractive) {
		log.warn('This dirty state will be recorded.')
		const shouldContinue = await confirm({
			message: 'Continue?',
			initialValue: false,
		})
		if (isCancel(shouldContinue) || !shouldContinue)
			throw new Error('Cancelled')
	}

	const { runtimeVersion, fingerprint } = await getRuntimeVersion(
		projectDirectory,
		argumentsMap,
	)
	if (!isNonInteractive) {
		note(
			`channel: ${channelName}\nruntimeVersion: ${runtimeVersion}\ncommit: ${commitSha}\nworking tree: ${hasUncommittedChanges ? 'dirty' : 'clean'}\nexport: ${shouldSkipExport ? 'existing dist' : 'build Android export'}\nfingerprint: ${fingerprint ? `${fingerprint.sources.length} sources` : 'not uploaded'}`,
			'Publish summary',
		)
		const shouldPublish = await confirm({
			message: shouldSkipExport
				? 'Publish existing export?'
				: 'Export and publish?',
			initialValue: true,
		})
		if (isCancel(shouldPublish) || !shouldPublish) throw new Error('Cancelled')
	}

	const distributionDirectory = resolve(
		projectDirectory,
		String(argumentsMap.dist ?? 'dist'),
	)
	log.step(
		shouldSkipExport
			? 'Using existing Android export'
			: 'Exporting Android update',
	)
	try {
		if (shouldSkipExport) {
			await ensureExpoExportExists(distributionDirectory)
		} else {
			// exportAndroidUpdate rejects on every non-zero Expo exit. Do not create
			// an archive or make a network request unless this command completed.
			await exportAndroidUpdate(projectDirectory, distributionDirectory)
		}
		await writeFile(
			join(distributionDirectory, 'expoConfig.json'),
			await getPublicExpoConfig(projectDirectory),
		)
		log.success(shouldSkipExport ? 'Existing export is ready' : 'Exported')
	} catch (error) {
		log.error(shouldSkipExport ? 'Existing export is invalid' : 'Export failed')
		throw error
	}

	const temporaryDirectory = await mkdtemp(
		join(tmpdir(), 'bbplayer-hot-update-'),
	)
	try {
		const archivePath = join(temporaryDirectory, 'update.zip')
		await createZipArchive(distributionDirectory, archivePath)
		await uploadUpdate(argumentsMap, archivePath, {
			channel: channelName,
			runtime_version: runtimeVersion,
			message: releaseMessage,
			source: {
				commit_sha: commitSha,
				working_tree_clean: !hasUncommittedChanges,
			},
			...(fingerprint ? { fingerprint } : {}),
		})
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true })
	}
}
