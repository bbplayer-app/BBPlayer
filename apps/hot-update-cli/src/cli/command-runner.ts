import { spawn } from 'node:child_process'

export class ExternalCommandError extends Error {
	constructor(
		readonly command: string,
		readonly argumentsList: string[],
		readonly exitCode: number | null,
		readonly output: string,
	) {
		super(
			`${command} ${argumentsList.join(' ')} failed${exitCode === null ? '' : ` with exit code ${exitCode}`}\n${output}`,
		)
	}
}

export async function runCommand(
	command: string,
	argumentsList: string[],
	workingDirectory: string,
): Promise<string> {
	return await new Promise((resolve, reject) => {
		const childProcess = spawn(command, argumentsList, {
			cwd: workingDirectory,
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		let output = ''
		let settled = false

		const settleWithError = (error: Error) => {
			if (settled) return
			settled = true
			reject(error)
		}

		childProcess.stdout.on('data', (chunk: Buffer) => {
			output += chunk.toString()
		})
		childProcess.stderr.on('data', (chunk: Buffer) => {
			output += chunk.toString()
		})
		childProcess.once('error', settleWithError)
		childProcess.once('close', (exitCode) => {
			if (settled) return
			settled = true
			if (exitCode === 0) resolve(output)
			else
				reject(
					new ExternalCommandError(command, argumentsList, exitCode, output),
				)
		})
	})
}
