import { isCancel, password, text } from '@clack/prompts'

export async function promptForRequiredValue(
	message: string,
	initialValue = '',
): Promise<string> {
	const response = await text({
		message,
		initialValue,
		validate: (value) => ((value ?? '').trim() ? undefined : 'Required'),
	})

	if (isCancel(response) || !response.trim()) throw new Error('Cancelled')
	return response.trim()
}

export async function promptForSecretValue(message: string): Promise<string> {
	const response = await password({ message })
	if (isCancel(response) || !response.trim()) throw new Error('Cancelled')
	return response.trim()
}
