import * as SecureStore from 'expo-secure-store'

import useAppStore from '@/hooks/stores/useAppStore'

const LLM_API_KEY_STORAGE_KEY = 'bbplayer.llm.apiKey'

export const llmCredentialService = {
	async getApiKey() {
		return (await SecureStore.getItemAsync(LLM_API_KEY_STORAGE_KEY)) ?? ''
	},

	async setApiKey(apiKey: string) {
		const trimmed = apiKey.trim()
		if (!trimmed) {
			await SecureStore.deleteItemAsync(LLM_API_KEY_STORAGE_KEY)
			return
		}
		await SecureStore.setItemAsync(LLM_API_KEY_STORAGE_KEY, trimmed)
	},

	async migrateFromPlainSettings() {
		const settings = useAppStore.getState().settings
		const plainApiKey = settings.llmApiKey?.trim()
		if (!plainApiKey) return

		const existing = await this.getApiKey()
		if (!existing) {
			await this.setApiKey(plainApiKey)
		}
		useAppStore.getState().setSettings({ llmApiKey: undefined })
	},
}
