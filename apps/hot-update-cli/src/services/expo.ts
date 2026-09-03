import { createRequire } from 'node:module'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'

import { runCommand } from '../cli/command-runner.js'

function resolveExpoCliPath(projectDirectory: string): string {
	// Resolve from the app's package boundary. This matches Expo/EAS project
	// discovery and avoids inheriting the update CLI's pnpm execution context.
	const projectRequire = createRequire(resolve(projectDirectory, 'package.json'))
	try {
		return projectRequire.resolve('expo/bin/cli')
	} catch (error) {
		const reason = error instanceof Error ? `: ${error.message}` : ''
		throw new Error(
			`Unable to resolve Expo from project directory ${projectDirectory}${reason}`,
		)
	}
}

export async function runExpoCommand(
	projectDirectory: string,
	argumentsList: string[],
	forwardOutput = false,
): Promise<string> {
	const expoCliPath = resolveExpoCliPath(projectDirectory)
	return await runCommand(
		process.execPath,
		[expoCliPath, ...argumentsList],
		projectDirectory,
		{ forwardOutput },
	)
}

export async function exportAndroidUpdate(
	projectDirectory: string,
	distributionDirectory: string,
): Promise<void> {
	await runExpoCommand(projectDirectory, [
		'export',
		'--clear',
		'--platform',
		'android',
		'--output-dir',
		distributionDirectory,
	], true)
}

export async function getPublicExpoConfig(
	projectDirectory: string,
): Promise<string> {
	return await runExpoCommand(projectDirectory, ['config', '--type', 'public', '--json'])
}

export async function ensureExpoExportExists(
	distributionDirectory: string,
): Promise<void> {
	try {
		await access(resolve(distributionDirectory, 'metadata.json'))
	} catch {
		throw new Error(
			`No Expo export found at ${distributionDirectory}. Run expo export first, or omit --skip-export.`,
		)
	}
}
