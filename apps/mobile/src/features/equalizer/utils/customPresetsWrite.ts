import type { EqualizerPreset } from '@bbplayer/orpheus'

export async function persistCustomPresetsWithRollback(
	previous: readonly EqualizerPreset[],
	next: readonly EqualizerPreset[],
	apply: (presets: EqualizerPreset[]) => void,
	write: (presets: EqualizerPreset[]) => Promise<void>,
): Promise<void> {
	apply([...next])

	try {
		await write([...next])
	} catch (error) {
		apply([...previous])

		throw error
	}
}
