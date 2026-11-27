import type { EqualizerPreset } from '@bbplayer/orpheus'

export type EqDataStatus = 'loading' | 'ready' | 'error'

export interface EqReadiness {
	settings: EqDataStatus
	presets: EqDataStatus
}

export function createEqReadiness(isSupported: boolean): EqReadiness {
	const initial: EqDataStatus = isSupported ? 'loading' : 'ready'

	return { settings: initial, presets: initial }
}

export function isEqDataLoading(readiness: EqReadiness): boolean {
	return readiness.settings === 'loading' || readiness.presets === 'loading'
}

export function isSettingsFailed(readiness: EqReadiness): boolean {
	return readiness.settings === 'error'
}

export function isPresetsFailed(readiness: EqReadiness): boolean {
	return readiness.presets === 'error'
}

export function canWriteSettings(readiness: EqReadiness): boolean {
	return readiness.settings === 'ready'
}

export function canWriteCustomPresets(readiness: EqReadiness): boolean {
	return readiness.presets === 'ready'
}

export function resolveSettingsStatus(
	result: PromiseSettledResult<unknown>,
): EqDataStatus {
	return result.status === 'fulfilled' ? 'ready' : 'error'
}

export function resolvePresetsStatus(
	result: PromiseSettledResult<string>,
): EqDataStatus {
	if (result.status === 'rejected' || result.value === '') return 'error'

	return 'ready'
}

export function resolveEditingCustomPresetId(
	activePresetId: string | null,
	customPresets: readonly EqualizerPreset[],
): string | null {
	if (!activePresetId) return null

	return customPresets.some((preset) => preset.id === activePresetId)
		? activePresetId
		: null
}
