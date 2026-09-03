import { runCommand } from '../cli/command-runner.js'

export async function runGitCommand(
	projectDirectory: string,
	argumentsList: string[],
): Promise<string> {
	return (await runCommand('git', argumentsList, projectDirectory)).trim()
}
