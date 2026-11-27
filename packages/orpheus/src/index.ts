export * from './ExpoOrpheusModule'

export {
	BUILTIN_EQ_PRESETS,
	EQ_BAND_COUNT,
	EQ_BAND_LABELS,
	EQ_DEFAULT_SAMPLE_RATE,
	EQ_FREQUENCIES,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
	clampEqGain,
	normalizeEqGains,
} from './equalizerPresets'

export type { EqualizerPreset, EqualizerSettings } from './equalizerPresets'

export * from './hooks'

export * from './headless'
