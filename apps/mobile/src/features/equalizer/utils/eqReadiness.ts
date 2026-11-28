import type { EqualizerPreset } from '@bbplayer/orpheus'

export type EqDataStatus = 'loading' | 'ready' | 'error'

export interface EqReadiness {
	settings: EqDataStatus
	presets: EqDataStatus
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
