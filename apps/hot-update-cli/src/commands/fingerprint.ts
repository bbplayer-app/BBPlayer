import { createFingerprintAsync } from '@expo/fingerprint'

import { resolveProjectDirectory } from '../services/project.js'
import type { CommandArguments } from '../types.js'

export async function showFingerprint(
	argumentsMap: CommandArguments,
): Promise<void> {
	const projectDirectory = await resolveProjectDirectory(
		argumentsMap['project-dir'],
	)
	const fingerprint = await createFingerprintAsync(projectDirectory, {
		platforms: ['android'],
		silent: true,
	})

	if (argumentsMap.json) {
		process.stdout.write(`${JSON.stringify(fingerprint)}\n`)
		return
	}
	process.stdout.write(`${fingerprint.hash}\n`)
}
