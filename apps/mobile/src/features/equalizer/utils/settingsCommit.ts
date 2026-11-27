import type { EqualizerSettings } from '@bbplayer/orpheus'

export interface SettingsSnapshotRef {
	current: EqualizerSettings
}

export function commitSettingsToRef(
	ref: SettingsSnapshotRef,
	setSettings: (next: EqualizerSettings) => void,
	update: (previous: EqualizerSettings) => EqualizerSettings,
): void {
	const next = update(ref.current)

	ref.current = next

	setSettings(next)
}
