export const EQ_BAND_COUNT = 10

export const EQ_FREQUENCIES = [
	31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const

export const EQ_BAND_LABELS = [
	'31',
	'62',
	'125',
	'250',
	'500',
	'1k',
	'2k',
	'4k',
	'8k',
	'16k',
] as const

export const EQ_MIN_GAIN_DB = -12

export const EQ_MAX_GAIN_DB = 12

export const EQ_DEFAULT_SAMPLE_RATE = 44100

export interface EqualizerPreset {
	id: string
	name: string
	gainsDb: number[]
	preampDb: number
	isBuiltin: boolean
}

export interface EqualizerSettings {
	enabled: boolean
	preampDb: number
	limiterEnabled: boolean
	gainsDb: number[]
	activePresetId: string | null
}

export function clampEqGain(gainDb: number): number {
	if (!Number.isFinite(gainDb)) return 0

	return Math.min(EQ_MAX_GAIN_DB, Math.max(EQ_MIN_GAIN_DB, gainDb))
}

export function normalizeEqGains(gainsDb: readonly number[]): number[] {
	const normalized: number[] = []

	for (let index = 0; index < EQ_BAND_COUNT; index += 1) {
		normalized.push(clampEqGain(gainsDb[index] ?? 0))
	}

	return normalized
}

function createPreset(
	id: string,
	name: string,
	gainsDb: readonly number[],
	preampDb: number,
): EqualizerPreset {
	return {
		id,
		name,
		gainsDb: normalizeEqGains(gainsDb),
		preampDb: clampEqGain(preampDb),
		isBuiltin: true,
	}
}

export const BUILTIN_EQ_PRESETS: readonly EqualizerPreset[] = [
	createPreset('flat', '平坦', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0),
	createPreset('pop', '流行', [-1.5, -0.5, 1.5, 3, 2, -1, -1, 0, 1.5, 1], -2),
	createPreset('rock', '摇滚', [3, 2.5, -1, -2, -1, 1, 2.5, 3.5, 3.5, 2.5], -3),
	createPreset(
		'bass_boost',
		'重低音',
		[7, 6, 4.5, 2, 0, -0.5, -0.5, 0, 0.5, 0.5],
		-4,
	),
	createPreset(
		'vocal',
		'人声清晰',
		[-4, -3, -1, 2, 4.5, 4.5, 3, 2, 0.5, -1],
		-3,
	),
	createPreset(
		'electronic',
		'电子',
		[5, 4, 1, 0, -1.5, 1, 2, 3.5, 4.5, 4],
		-3.5,
	),
	createPreset('classical', '古典', [0, 0, 0, 0, 0, 0, 1, 2, 3, 3], -1.5),
	createPreset(
		'soft_night',
		'柔和/夜间',
		[-3, -2, -1, 0.5, 1.5, 1, 0, -1.5, -2.5, -3.5],
		1,
	),
]
