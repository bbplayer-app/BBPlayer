import { access, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function resolveProjectDirectory(
	projectDirectoryArgument: string | boolean | undefined,
): Promise<string> {
	const projectDirectory = resolve(
		typeof projectDirectoryArgument === 'string'
			? projectDirectoryArgument
			: process.cwd(),
	)

	try {
		if (!(await stat(projectDirectory)).isDirectory()) {
			throw new Error('not a directory')
		}
		await access(resolve(projectDirectory, 'package.json'))
	} catch {
		throw new Error(`Project directory is invalid: ${projectDirectory}`)
	}

	return projectDirectory
}
