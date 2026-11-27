import type { EqualizerPreset, EqualizerSettings } from '@bbplayer/orpheus'

export function buildPresetSettings(
	preset: EqualizerPreset,
	currentSettings: EqualizerSettings,
): EqualizerSettings {
	return {
		...currentSettings,
		activePresetId: preset.id,
		gainsDb: [...preset.gainsDb],
		preampDb: preset.preampDb,
	}
}
