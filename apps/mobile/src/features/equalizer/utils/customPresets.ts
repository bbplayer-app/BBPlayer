import type { EqualizerPreset } from '@bbplayer/orpheus'
import { ArkErrors, type as arkType } from 'arktype'

const EQ_BAND_COUNT = 10

const EQ_MIN_GAIN_DB = -12

const EQ_MAX_GAIN_DB = 12

const MAX_PRESET_NAME_LENGTH = 24

const CUSTOM_PRESET_ID_PREFIX = 'custom-'

const FALLBACK_PRESET_NAME = '自定义'

export const BUILTIN_EQ_PRESET_IDS = [
	'flat',
	'pop',
	'rock',
	'bass_boost',
	'vocal',
	'electronic',
	'classical',
	'soft_night',
] as const

const BUILTIN_PRESET_ID_SET = new Set<string>(BUILTIN_EQ_PRESET_IDS)

const storedPresetListSchema = arkType('unknown[]')

const storedPresetSchema = arkType({
	'id?': 'string',
	'name?': 'string',
	'gainsDb?': 'number[]',
	'preampDb?': 'number',
})

export interface CustomPresetInput {
	id?: string
	name: string
	gainsDb: readonly number[]
	preampDb: number
}

export interface UpsertCustomPresetResult {
	presets: EqualizerPreset[]
	preset: EqualizerPreset | null
}

function clampGainDb(value: number): number {
	if (!Number.isFinite(value)) return 0

	return Math.min(EQ_MAX_GAIN_DB, Math.max(EQ_MIN_GAIN_DB, value))
}

function normalizeGains(gainsDb: readonly number[] | undefined): number[] {
	const gains: number[] = []

	for (let index = 0; index < EQ_BAND_COUNT; index += 1) {
		gains.push(clampGainDb(gainsDb?.[index] ?? 0))
	}

	return gains
}

function sanitizePresetName(name: string): string {
	return Array.from(name.trim()).slice(0, MAX_PRESET_NAME_LENGTH).join('')
}

function nextCustomPresetId(presets: readonly EqualizerPreset[]): string {
	const usedIds = new Set(presets.map((preset) => preset.id))

	let index = presets.length + 1

	while (usedIds.has(`${CUSTOM_PRESET_ID_PREFIX}${index}`)) {
		index += 1
	}

	return `${CUSTOM_PRESET_ID_PREFIX}${index}`
}

export function parseCustomPresetsJson(raw: string): EqualizerPreset[] {
	if (!raw) return []

	let parsed: unknown

	try {
		parsed = JSON.parse(raw)
	} catch {
		return []
	}

	const entries = storedPresetListSchema(parsed)

	if (entries instanceof ArkErrors) return []

	const presets: EqualizerPreset[] = []

	const seenIds = new Set<string>()

	for (const entry of entries) {
		const record = storedPresetSchema(entry)

		if (record instanceof ArkErrors) continue

		const id = record.id?.trim() ?? ''

		const name = sanitizePresetName(record.name ?? '')

		if (!id || !name || seenIds.has(id) || BUILTIN_PRESET_ID_SET.has(id)) {
			continue
		}

		seenIds.add(id)

		presets.push({
			id,
			name,
			gainsDb: normalizeGains(record.gainsDb),
			preampDb: clampGainDb(record.preampDb ?? 0),
			isBuiltin: false,
		})
	}

	return presets
}

export function serializeCustomPresets(
	presets: readonly EqualizerPreset[],
): string {
	return JSON.stringify(
		presets.map((preset) => ({
			id: preset.id,
			name: sanitizePresetName(preset.name),
			gainsDb: normalizeGains(preset.gainsDb),
			preampDb: clampGainDb(preset.preampDb),
			isBuiltin: false,
		})),
	)
}

export function upsertCustomPreset(
	presets: readonly EqualizerPreset[],
	input: CustomPresetInput,
): UpsertCustomPresetResult {
	const name = sanitizePresetName(input.name)

	if (!name) return { presets: [...presets], preset: null }

	const gainsDb = normalizeGains(input.gainsDb)

	const preampDb = clampGainDb(input.preampDb)

	const requestedId = input.id?.trim()

	const targetId =
		requestedId && !BUILTIN_PRESET_ID_SET.has(requestedId)
			? requestedId
			: undefined

	if (targetId) {
		const existing = presets.find((preset) => preset.id === targetId)

		if (existing) {
			const updated: EqualizerPreset = {
				id: existing.id,
				name,
				gainsDb,
				preampDb,
				isBuiltin: false,
			}

			return {
				presets: presets.map((preset) =>
					preset.id === updated.id ? updated : preset,
				),
				preset: updated,
			}
		}
	}

	const created: EqualizerPreset = {
		id: targetId ?? nextCustomPresetId(presets),
		name,
		gainsDb,
		preampDb,
		isBuiltin: false,
	}

	return { presets: [...presets, created], preset: created }
}

export function renameCustomPreset(
	presets: readonly EqualizerPreset[],
	id: string,
	newName: string,
): EqualizerPreset[] {
	const name = sanitizePresetName(newName)

	if (!name) return [...presets]

	return presets.map((preset) =>
		preset.id === id ? { ...preset, name, isBuiltin: false } : preset,
	)
}

export function deleteCustomPreset(
	presets: readonly EqualizerPreset[],
	id: string,
): EqualizerPreset[] {
	return presets.filter((preset) => preset.id !== id)
}

export function findPresetDisplayName(
	activePresetId: string | null,
	builtinPresets: readonly EqualizerPreset[],
	customPresets: readonly EqualizerPreset[],
): string {
	if (!activePresetId) return FALLBACK_PRESET_NAME

	const matched =
		builtinPresets.find((preset) => preset.id === activePresetId) ??
		customPresets.find((preset) => preset.id === activePresetId)

	return matched ? matched.name : FALLBACK_PRESET_NAME
}
