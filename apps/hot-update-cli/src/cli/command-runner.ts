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
	options: { forwardOutput?: boolean } = {},
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
			const text = chunk.toString()
			output += text
			if (options.forwardOutput) process.stdout.write(text)
		})
		childProcess.stderr.on('data', (chunk: Buffer) => {
			const text = chunk.toString()
			output += text
			if (options.forwardOutput) process.stderr.write(text)
		})
		childProcess.once('error', settleWithError)
		childProcess.once('close', (exitCode) => {
			if (settled) return
			settled = true
			if (exitCode === 0) resolve(output)
			else
				reject(
					new ExternalCommandError(
						command,
						argumentsList,
						exitCode,
						options.forwardOutput ? '' : output,
					),
				)
		})
	})
}
